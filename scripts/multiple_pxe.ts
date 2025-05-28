import { waitForPXE, getContractInstanceFromDeployParams, Fr, ContractInstanceWithAddress, AztecAddress, SponsoredFeePaymentMethod, createAztecNodeClient } from "@aztec/aztec.js";
import { TokenContract } from "@aztec/noir-contracts.js/Token"
import { getSponsoredFPCInstance } from "../src/utils/sponsored_fpc.js";
import { deriveSigningKey } from "@aztec/stdlib/keys";
import { getSchnorrAccount } from "@aztec/accounts/schnorr";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { createPXEService, getPXEServiceConfig } from '@aztec/pxe/server';
import { createStore } from "@aztec/kv-store/lmdb"

const { NODE_URL = "https://aztec-alpha-testnet-fullnode.zkv.xyz" } = process.env;
const node = createAztecNodeClient(NODE_URL)
const l1Contracts = await node.getL1ContractAddresses();
const config = getPXEServiceConfig()
const fullConfig = { ...config, l1Contracts }
fullConfig.proverEnabled = true;

const store1 = await createStore('pxe1', {
    dataDirectory: 'store',
    dataStoreMapSizeKB: 1e6,
});

const store2 = await createStore('pxe2', {
    dataDirectory: 'store',
    dataStoreMapSizeKB: 1e6,
});

const setupPxe1 = async () => {
    const pxe = await createPXEService(node, fullConfig, {store: store1});
    await waitForPXE(pxe);
    return pxe;
};

const setupPxe2 = async () => {
    const pxe = await createPXEService(node, fullConfig, {store: store2});
    await waitForPXE(pxe);
    return pxe;
};

const L2_TOKEN_CONTRACT_SALT = Fr.random();

export async function getL2TokenContractInstance(deployerAddress: any, ownerAztecAddress: AztecAddress): Promise<ContractInstanceWithAddress> {
    return await getContractInstanceFromDeployParams(
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
    const sponseredFPC = await getSponsoredFPCInstance();
    await pxe1.registerContract({ instance: sponseredFPC, artifact: SponsoredFPCContract.artifact });
    await pxe2.registerContract({ instance: sponseredFPC, artifact: SponsoredFPCContract.artifact });
    const paymentMethod = new SponsoredFeePaymentMethod(sponseredFPC.address);
    // deploy token contract

    let secretKey = Fr.random();
    let salt = Fr.random();
    let schnorrAccount = await getSchnorrAccount(pxe1, secretKey, deriveSigningKey(secretKey), salt);
    let tx = await schnorrAccount.deploy({ fee: { paymentMethod } }).wait({timeout: 120000});
    let ownerWallet = await schnorrAccount.getWallet();
    let ownerAddress = await ownerWallet.getAddress();
    const token = await TokenContract.deploy(ownerWallet, ownerAddress, 'Clean USDC', 'USDC', 6).send({ contractAddressSalt: L2_TOKEN_CONTRACT_SALT, fee: { paymentMethod } }).wait({timeout: 120000})

    // setup account on 2nd pxe

    pxe2.registerSender(ownerAddress)

    let secretKey2 = Fr.random();
    let salt2 = Fr.random();
    let schnorrAccount2 = await getSchnorrAccount(pxe2, secretKey2, deriveSigningKey(secretKey2), salt2);

    // deploy account on 2nd pxe
    let tx2 = await schnorrAccount2.deploy({ fee: { paymentMethod } }).wait({timeout: 120000});
    let wallet2 = await schnorrAccount2.getWallet();
    wallet2.registerSender(ownerAddress)

    // mint to account on 2nd pxe

    const private_mint_tx = await token.contract.methods.mint_to_private(ownerAddress, schnorrAccount2.getAddress(), 100).send({ fee: { paymentMethod } }).wait({timeout: 120000})
    console.log(await pxe1.getTxEffect(private_mint_tx.txHash))
    await token.contract.methods.mint_to_public(schnorrAccount2.getAddress(), 100).send({ fee: { paymentMethod } }).wait({timeout: 120000})


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

    await l2TokenContract.methods.sync_private_state().simulate()

    const notes = await pxe2.getNotes({ txHash: private_mint_tx.txHash });
    console.log(notes)

    // returns 0n
    const balance = await l2TokenContract.methods.balance_of_private(wallet2.getAddress()).simulate()
    console.log("private balance should be 100", balance)
    // errors
    const public_balance = await l2TokenContract.methods.balance_of_public(wallet2.getAddress()).simulate()

}

main();