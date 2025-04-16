import { EasyPrivateVotingContract } from "../src/artifacts/EasyPrivateVoting.js"
import { createLogger, PXE, waitForPXE, createPXEClient, Logger, AztecAddress } from "@aztec/aztec.js";
import { TokenContract } from "@aztec/noir-contracts.js/Token"
import { getSponsoredFPCAddress } from "../src/utils/sponsored_fpc.js";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { deploySchnorrAccount } from "./deploy-account.js";

const setupPXE = async () => {
    const { PXE_URL = 'http://localhost:8081' } = process.env;
    const pxe = await createPXEClient(PXE_URL);
    await waitForPXE(pxe);
    return pxe;
};

async function main() {

    let pxe: PXE;
    let logger: Logger;

    logger = createLogger('aztec:aztec-starter');

    pxe = await setupPXE();

    const wallet = await deploySchnorrAccount();

    const sponseredFPCAddress = await getSponsoredFPCAddress();
    const paymentMethod = new SponsoredFeePaymentMethod(sponseredFPCAddress);

    const votingContract = await EasyPrivateVotingContract.deploy(wallet, wallet.getAddress()).send({ fee: { paymentMethod }}).deployed();
    logger.info(`Voting Contract deployed at: ${votingContract.address}`);
}

main();
