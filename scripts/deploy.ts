import { EasyPrivateVotingContract } from "../src/artifacts/EasyPrivateVoting.js"
import { AccountWallet, CompleteAddress, createLogger, FeeJuicePaymentMethod, Fr, PXE, waitForPXE, createPXEClient, Logger } from "@aztec/aztec.js";
import { getSchnorrAccount } from '@aztec/accounts/schnorr';
import { deriveSigningKey } from '@aztec/stdlib/keys';
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { TokenContract } from "@aztec/noir-contracts.js/Token"
import { bridgeFeeJuice } from '../utils/bridgeFeeJuice.js'
import { FEE_FUNDING_FOR_TESTER_ACCOUNT } from '@aztec/constants';

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

    let secretKey = Fr.random();
    let salt = Fr.random();

    let schnorrAccount = await getSchnorrAccount(pxe, secretKey, deriveSigningKey(secretKey), salt);
    const { address, publicKeys, partialAddress } = await schnorrAccount.getCompleteAddress();
    await bridgeFeeJuice(pxe, address, FEE_FUNDING_FOR_TESTER_ACCOUNT)
    const paymentMethod = new FeeJuicePaymentMethod(address);

    await EasyPrivateVotingContract.deploy(wallets[0], address).send().deployed();    
    await EasyPrivateVotingContract.deploy(wallets[0], address).send().deployed();

    let tx = await schnorrAccount.deploy({fee: {paymentMethod}}).wait();
    let wallet = await schnorrAccount.getWallet();

    // const votingContract = await EasyPrivateVotingContract.deploy(wallets[0], address).send().deployed();
    // logger.info(`Voting Contract deployed at: ${votingContract.address}`);
}

main();
