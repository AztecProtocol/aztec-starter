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
import { getEnv, getAztecNodeUrl, getTimeouts } from "../config/config.js";
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

    const timeouts = getTimeouts();

    let secretKey = Fr.random();
    let signingKey = GrumpkinScalar.random();
    let salt = Fr.random();
    let schnorrAccount = await wallet1.createSchnorrAccount(secretKey, salt, signingKey);
    const deployMethod = await schnorrAccount.getDeployMethod();
    await deployMethod.send({ from: AztecAddress.ZERO, fee: { paymentMethod }, wait: { timeout: timeouts.deployTimeout } });
    let ownerAddress = schnorrAccount.address;
    const token = await TokenContract.deploy(wallet1, ownerAddress, 'Clean USDC', 'USDC', 6).send({
        from: ownerAddress,
        contractAddressSalt: L2_TOKEN_CONTRACT_SALT,
        fee: { paymentMethod },
        wait: { timeout: timeouts.deployTimeout }
    });

    // setup account on 2nd pxe

    await wallet2.registerSender(ownerAddress)

    let secretKey2 = Fr.random();
    let signingKey2 = GrumpkinScalar.random();
    let salt2 = Fr.random();
    let schnorrAccount2 = await wallet2.createSchnorrAccount(secretKey2, salt2, signingKey2);

    // deploy account on 2nd pxe
    const deployMethod2 = await schnorrAccount2.getDeployMethod();
    await deployMethod2.send({ from: AztecAddress.ZERO, fee: { paymentMethod }, wait: { timeout: timeouts.deployTimeout } });
    let wallet2Address = schnorrAccount2.address;
    await wallet2.registerSender(ownerAddress)

    // mint to account on 2nd pxe

    const private_mint_tx = await token.methods.mint_to_private(schnorrAccount2.address, 100).send({
        from: ownerAddress,
        fee: { paymentMethod },
        wait: { timeout: timeouts.txTimeout }
    });
    console.log(await node.getTxEffect(private_mint_tx.txHash))
    await token.methods.mint_to_public(schnorrAccount2.address, 100).send({
        from: ownerAddress,
        fee: { paymentMethod },
        wait: { timeout: timeouts.txTimeout }
    });


    // In v4, get the contract instance from the node instead of reconstructing locally
    const tokenInstance = await node.getContract(token.address);
    if (!tokenInstance) {
        throw new Error("Token contract not found on node");
    }
    await wallet2.registerContract(tokenInstance, TokenContract.artifact);

    const l2TokenContract = await TokenContract.at(
        token.address,
        wallet2
    )

    // Check balances
    const balance = await l2TokenContract.methods.balance_of_private(wallet2Address).simulate({
        from: wallet2Address
    })
    console.log("private balance should be 100", balance)

    const publicBalance = await l2TokenContract.methods.balance_of_public(wallet2Address).simulate({
        from: wallet2Address
    })
    console.log("public balance should be 100", publicBalance)

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
