import { waitForPXE, getContractInstanceFromInstantiationParams, Fr, ContractInstanceWithAddress, AztecAddress, SponsoredFeePaymentMethod, createAztecNodeClient, Fq } from "@aztec/aztec.js";
import { TokenContract } from "@aztec/noir-contracts.js/Token"
import { getSponsoredFPCInstance } from "../src/utils/sponsored_fpc.js";
import { getSchnorrAccount } from "@aztec/accounts/schnorr";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { createPXEService, getPXEServiceConfig } from '@aztec/pxe/server';
import { createStore } from "@aztec/kv-store/lmdb"  
import { getEnv, getAztecNodeUrl } from "../config/config.js";

const nodeUrl = getAztecNodeUrl();
const node = createAztecNodeClient(nodeUrl)
const l1Contracts = await node.getL1ContractAddresses();
const config = getPXEServiceConfig()
const fullConfig = { ...config, l1Contracts }
fullConfig.proverEnabled = getEnv() !== 'sandbox';

const store1 = await createStore('pxe1', {
    dataDirectory: 'store',
    dataStoreMapSizeKB: 1e6,
});

const store2 = await createStore('pxe2', {
    dataDirectory: 'store',
    dataStoreMapSizeKB: 1e6,
});

const setupPxe1 = async () => {
    const pxe = await createPXEService(node, fullConfig, { store: store1 });
    await waitForPXE(pxe);
    return pxe;
};

const setupPxe2 = async () => {
    const pxe = await createPXEService(node, fullConfig, { store: store2 });
    await waitForPXE(pxe);
    return pxe;
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

    const pxe1 = await setupPxe1();
    const pxe2 = await setupPxe2();
    const sponsoredFPC = await getSponsoredFPCInstance();
    await pxe1.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });
    await pxe2.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });
    const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
    // deploy token contract

    let secretKey = Fr.random();
    let signingKey = Fq.random();
    let salt = Fr.random();
    let schnorrAccount = await getSchnorrAccount(pxe1, secretKey, signingKey, salt);
    let tx = await schnorrAccount.deploy({ fee: { paymentMethod } }).wait();
    let ownerWallet = await schnorrAccount.getWallet();
    let ownerAddress = ownerWallet.getAddress();
    const token = await TokenContract.deploy(ownerWallet, ownerAddress, 'Clean USDC', 'USDC', 6).send({
        from: ownerAddress,
        contractAddressSalt: L2_TOKEN_CONTRACT_SALT,
        fee: { paymentMethod }
    }).wait()

    // setup account on 2nd pxe

    await pxe2.registerSender(ownerAddress)

    let secretKey2 = Fr.random();
    let signingKey2 = Fq.random();
    let salt2 = Fr.random();
    let schnorrAccount2 = await getSchnorrAccount(pxe2, secretKey2, signingKey2, salt2);

    // deploy account on 2nd pxe
    let tx2 = await schnorrAccount2.deploy({ fee: { paymentMethod } }).wait();
    let wallet2 = await schnorrAccount2.getWallet();
    await wallet2.registerSender(ownerAddress)

    // mint to account on 2nd pxe

    const private_mint_tx = await token.contract.methods.mint_to_private(schnorrAccount2.getAddress(), 100).send({
        from: ownerAddress,
        fee: { paymentMethod }
    }).wait()
    console.log(await pxe1.getTxEffect(private_mint_tx.txHash))
    await token.contract.methods.mint_to_public(schnorrAccount2.getAddress(), 100).send({
        from: ownerAddress,
        fee: { paymentMethod }
    }).wait()


    // setup token on 2nd pxe

    const l2TokenContractInstance = await getL2TokenContractInstance(ownerAddress, ownerAddress)
    await wallet2.registerContract({
        instance: l2TokenContractInstance,
        artifact: TokenContract.artifact
    })

    const l2TokenContract = await TokenContract.at(
        l2TokenContractInstance.address,
        wallet2
    )

    await l2TokenContract.methods.sync_private_state().simulate({
        from: wallet2.getAddress()
    })

    const notes = await pxe2.getNotes({ txHash: private_mint_tx.txHash, contractAddress: l2TokenContractInstance.address });
    console.log(notes)

    // returns 0n
    const balance = await l2TokenContract.methods.balance_of_private(wallet2.getAddress()).simulate({
        from: wallet2.getAddress()
    })
    console.log("private balance should be 100", balance)
    // errors
    await l2TokenContract.methods.balance_of_public(wallet2.getAddress()).simulate({
        from: wallet2.getAddress()
    })

}

main();
