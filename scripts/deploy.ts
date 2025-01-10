import { EasyPrivateVotingContract } from "../src/artifacts/EasyPrivateVoting.js"
import { AccountWallet, CompleteAddress, createLogger, AztecNode, Fr, PXE, waitForPXE, createPXEClient, Logger } from "@aztec/aztec.js";
import { getSchnorrAccount } from '@aztec/accounts/schnorr';
import { deriveSigningKey } from '@aztec/circuits.js';
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { TokenContract } from "@aztec/noir-contracts.js/Token"


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
    let logger: Logger;

    logger = createLogger('aztec:aztec-starter');

    pxe = await setupSandbox();
    wallets = await getInitialTestAccountsWallets(pxe);

    pxe.getL1ToL2MembershipWitness

    let secretKey = Fr.random();
    let salt = Fr.random();

    let schnorrAccount = await getSchnorrAccount(pxe, secretKey, deriveSigningKey(secretKey), salt);
    const { address, publicKeys, partialAddress } = schnorrAccount.getCompleteAddress();
    let tx = await schnorrAccount.deploy().wait();
    let wallet = await schnorrAccount.getWallet();

    const votingContract = await EasyPrivateVotingContract.deploy(wallet, address).send().deployed();
    logger.info(`Voting Contract deployed at: ${votingContract.address}`);
}

main();
