import { Fr } from "@aztec/aztec.js/fields";
import { GrumpkinScalar } from "@aztec/foundation/curves/grumpkin";
import { getContractInstanceFromInstantiationParams, type ContractInstanceWithAddress } from "@aztec/aztec.js/contracts";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { TokenContract } from "@aztec/noir-contracts.js/Token"
import { getSponsoredFPCInstance } from "../src/utils/sponsored_fpc.js";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { getPXEConfig } from "@aztec/pxe/config";
import { createStore } from "@aztec/kv-store/lmdb"
import { getEnv, getAztecNodeUrl } from "../config/config.js";
import { TestWallet } from "@aztec/test-wallet/server";

const nodeUrl = getAztecNodeUrl();
const node = createAztecNodeClient(nodeUrl)
const l1Contracts = await node.getL1ContractAddresses();
const config = getPXEConfig()
const fullConfig = { ...config, l1Contracts }
fullConfig.proverEnabled = getEnv() !== 'local-network';

const store1 = await createStore('pxe1', {
    dataDirectory: 'store',
    dataStoreMapSizeKb: 1e6,
});

const store2 = await createStore('pxe2', {
    dataDirectory: 'store',
    dataStoreMapSizeKb: 1e6,
});

const setupWallet1 = async () => {
    return await TestWallet.create(node, fullConfig, { store: store1 });
};

const setupWallet2 = async () => {
    return await TestWallet.create(node, fullConfig, { store: store2 });
};

const L2_TOKEN_CONTRACT_SALT = Fr.random();

export async function getL2TokenContractInstance(deployerAddress: any, ownerAztecAddress: AztecAddress): Promise<ContractInstanceWithAddress> {
    return await getContractInstanceFromInstantiationParams(
        TokenContract.artifact,
        {
            salt: L2_TOKEN_CONTRACT_SALT,
            deployer: deployerAddress,
            constructorArgs: [
                ownerAztecAddress,
                'Clean USDC',
                'USDC',
                6
            ]
        }
    )
}

async function main() {

    const wallet1 = await setupWallet1();
    const wallet2 = await setupWallet2();
    const sponsoredFPC = await getSponsoredFPCInstance();
    await wallet1.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
    await wallet2.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
    const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
    // deploy token contract

    let secretKey = Fr.random();
    let signingKey = GrumpkinScalar.random();
    let salt = Fr.random();
    let schnorrAccount = await wallet1.createSchnorrAccount(secretKey, salt, signingKey);
    const deployMethod = await schnorrAccount.getDeployMethod();
    await deployMethod.send({ from: AztecAddress.ZERO, fee: { paymentMethod } });
    let ownerAddress = schnorrAccount.address;
    const token = await TokenContract.deploy(wallet1, ownerAddress, 'Clean USDC', 'USDC', 6).send({
        from: ownerAddress,
        contractAddressSalt: L2_TOKEN_CONTRACT_SALT,
        fee: { paymentMethod }
    });

    // setup account on 2nd pxe

    await wallet2.registerSender(ownerAddress)

    let secretKey2 = Fr.random();
    let signingKey2 = GrumpkinScalar.random();
    let salt2 = Fr.random();
    let schnorrAccount2 = await wallet2.createSchnorrAccount(secretKey2, salt2, signingKey2);

    // deploy account on 2nd pxe
    const deployMethod2 = await schnorrAccount2.getDeployMethod();
    await deployMethod2.send({ from: AztecAddress.ZERO, fee: { paymentMethod } });
    let wallet2Address = schnorrAccount2.address;
    await wallet2.registerSender(ownerAddress)

    // mint to account on 2nd pxe

    const private_mint_tx = await token.methods.mint_to_private(schnorrAccount2.address, 100).send({
        from: ownerAddress,
        fee: { paymentMethod }
    });
    console.log(await node.getTxEffect(private_mint_tx.txHash))
    await token.methods.mint_to_public(schnorrAccount2.address, 100).send({
        from: ownerAddress,
        fee: { paymentMethod }
    });


    // setup token on 2nd pxe

    const l2TokenContractInstance = await getL2TokenContractInstance(ownerAddress, ownerAddress)
    await wallet2.registerContract(l2TokenContractInstance, TokenContract.artifact)

    const l2TokenContract = await TokenContract.at(
        l2TokenContractInstance.address,
        wallet2
    )

    const notes = await wallet2.getNotes({ contractAddress: l2TokenContractInstance.address });
    console.log(notes)

    // returns 0n
    const balance = await l2TokenContract.methods.balance_of_private(wallet2Address).simulate({
        from: wallet2Address
    })
    console.log("private balance should be 100", balance)
    // errors
    await l2TokenContract.methods.balance_of_public(wallet2Address).simulate({
        from: wallet2Address
    })

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
