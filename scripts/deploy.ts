import { AccountWallet, CompleteAddress, ContractDeployer, createDebugLogger, Fr, PXE, waitForPXE, TxStatus, createPXEClient, getContractInstanceFromDeployParams, DebugLogger } from "@aztec/aztec.js";
import { getSchnorrAccount } from '@aztec/accounts/schnorr';
import { AztecAddress, deriveSigningKey } from '@aztec/circuits.js';
import { TokenContract } from "@aztec/noir-contracts.js";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { SimpleLoggingContract } from "../src/artifacts/SimpleLogging.js";

const setupSandbox = async () => {
    const { PXE_URL = 'http://localhost:8080' } = process.env;
    const pxe = await createPXEClient(PXE_URL);
    await waitForPXE(pxe);
    return pxe;
};

async function main() {

    let pxe: PXE;
    let wallets: AccountWallet[] = [];
    let accounts: CompleteAddress[] = [];
    let logger: DebugLogger;

    logger = createDebugLogger('aztec:aztec-starter');

    pxe = await setupSandbox();
    wallets = await getInitialTestAccountsWallets(pxe);
    let contract = await SimpleLoggingContract.deploy(wallets[0]).send().deployed()
    logger.info(`Contract deployed: ${contract.address}`)
    // let secretKey = Fr.random();
    // let salt = Fr.random();

    // let schnorrAccount = await getSchnorrAccount(pxe, secretKey, deriveSigningKey(secretKey), salt);
    // const { address, publicKeys, partialAddress } = schnorrAccount.getCompleteAddress();
    // let tx = await schnorrAccount.deploy().wait();
    // console.log("tx", tx);
    // let wallet = await schnorrAccount.getWallet();

    // const votingContract = await EasyPrivateVotingContract.deploy(wallet, address).send().deployed();
    // logger.info(`Voting Contract deployed at: ${votingContract.address}`);
}

main();
