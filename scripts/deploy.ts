import { EasyPrivateVotingContract } from "../src/artifacts/EasyPrivateVoting.js";
import { AccountWallet, Fr, PXE, createPXEClient, waitForPXE, getContractInstanceFromDeployParams, createDebugLogger } from "@aztec/aztec.js";
import { getSchnorrAccount } from '@aztec/accounts/schnorr';
import { deriveSigningKey } from '@aztec/circuits.js';
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";

const setupPXE = async () => {
    const { PXE_URL = 'http://localhost:8080' } = process.env;
    const pxe = await createPXEClient(PXE_URL);
    await waitForPXE(pxe);
    return pxe;
};

const deployVotingContract = async (wallet, address) => {
    return await EasyPrivateVotingContract.deploy(wallet, address).send().deployed();
};

async function main() {
    const logger = createDebugLogger('aztec:optimized');
    const pxe = await setupPXE();
    const wallets = await getInitialTestAccountsWallets(pxe);
    
    const secretKey = Fr.random();
    const salt = Fr.random();
    const schnorrAccount = await getSchnorrAccount(pxe, secretKey, deriveSigningKey(secretKey), salt);
    const { address } = schnorrAccount.getCompleteAddress();
    
    await schnorrAccount.deploy().wait();
    const wallet = await schnorrAccount.getWallet();

    const votingContract = await deployVotingContract(wallet, address);
    logger.info(`Voting Contract deployed at: ${votingContract.address}`);
}

main();
