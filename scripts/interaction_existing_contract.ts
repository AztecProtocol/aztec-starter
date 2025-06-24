import { createLogger, Logger, SponsoredFeePaymentMethod, Fr, AztecAddress } from "@aztec/aztec.js";
import { EasyPrivateVotingContract } from "../src/artifacts/EasyPrivateVoting.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { setupPXE } from "../src/utils/setup_pxe.js";
import { getSponsoredFPCInstance } from "../src/utils/sponsored_fpc.js";
import { getAccountFromEnv } from "../src/utils/create_account_from_env.js";

async function main() {
    let logger: Logger;
    logger = createLogger('aztec:voting-operations-existing');

    // Setup PXE
    const pxe = await setupPXE();

    // Setup sponsored fee payment
    const sponsoredFPC = await getSponsoredFPCInstance();
    await pxe.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    // Get account from environment variables
    const accountManager = await getAccountFromEnv(pxe);
    const wallet = await accountManager.getWallet();

    // Connect to existing voting contract (replace with your deployed contract address)
    const contractAddress = process.env.VOTING_CONTRACT_ADDRESS;
    if (!contractAddress) {
        logger.error("Please set VOTING_CONTRACT_ADDRESS environment variable with your deployed contract address");
        return;
    }

    logger.info(`Connecting to voting contract at: ${contractAddress}`);
    const votingContract = await EasyPrivateVotingContract.at(
        AztecAddress.fromString(contractAddress),
        wallet
    );

    // Define a candidate to vote for (using a Field value)
    const candidate = Fr.fromString("1"); // Voting for candidate "1"

    // First get_vote call - check initial vote count
    logger.info("Getting initial vote count...");
    const initialVoteCount = await votingContract.methods.get_vote(candidate).simulate();
    logger.info(`Initial vote count for candidate ${candidate}: ${initialVoteCount}`);

    // Cast a vote
    logger.info("Casting vote...");
    await votingContract.methods.cast_vote(candidate)
        .send({ fee: { paymentMethod: sponsoredPaymentMethod } })
        .wait({ timeout: 120000 });
    logger.info("Vote cast successfully!");

    // Second get_vote call - check updated vote count
    logger.info("Getting updated vote count...");
    const updatedVoteCount = await votingContract.methods.get_vote(candidate).simulate();
    logger.info(`Updated vote count for candidate ${candidate}: ${updatedVoteCount}`);

    logger.info(`Vote count increased from ${initialVoteCount} to ${updatedVoteCount}`);
}

main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
}); 