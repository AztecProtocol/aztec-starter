import { Logger, createLogger } from "@aztec/aztec.js/log";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { Fr } from "@aztec/aztec.js/fields";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { PrivateVotingContract } from "../src/artifacts/PrivateVoting.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { setupWallet } from "../src/utils/setup_wallet.js";
import { getSponsoredFPCInstance } from "../src/utils/sponsored_fpc.js";
import { getAccountFromEnv } from "../src/utils/create_account_from_env.js";
import { getTimeouts } from "../config/config.js";
import { getContractInstanceFromInstantiationParams } from "@aztec/aztec.js/contracts";

async function main() {
    let logger: Logger;
    logger = createLogger('aztec:voting-operations-existing');

    const timeouts = getTimeouts();

    // Setup wallet
    const wallet = await setupWallet();

    // Setup sponsored fee payment
    const sponsoredFPC = await getSponsoredFPCInstance();
    await wallet.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    // Get account from environment variables
    const accountManager = await getAccountFromEnv(wallet);
    const address = accountManager.address;

    // Connect to existing voting contract (replace with your deployed contract address)
    const contractAddress = process.env.VOTING_CONTRACT_ADDRESS;
    if (!contractAddress) {
        logger.error("Please set VOTING_CONTRACT_ADDRESS environment variable with your deployed contract address");
        return;
    }

    logger.info(`Connecting to voting contract at: ${contractAddress}`);
    // Get instantiation parameters from environment variables
    const contractSalt = process.env.CONTRACT_SALT;
    const contractDeployer = process.env.CONTRACT_DEPLOYER;
    const constructorArgsJson = process.env.CONTRACT_CONSTRUCTOR_ARGS;

    if (!contractSalt || !contractDeployer || !constructorArgsJson) {
        logger.error("Missing contract instantiation data in .env file");
        logger.error("Please ensure CONTRACT_SALT, CONTRACT_DEPLOYER, and CONTRACT_CONSTRUCTOR_ARGS are set");
        return;
    }

    logger.info("📦 Reconstructing contract instance from environment variables...");

    // Parse constructor args
    let constructorArgs;
    try {
        // Remove any surrounding quotes, whitespace, and control characters
        let cleanedJson = constructorArgsJson.trim();
        // Remove surrounding quotes (single or double)
        cleanedJson = cleanedJson.replace(/^['"]|['"]$/g, '');
        // Remove any trailing whitespace or control characters
        cleanedJson = cleanedJson.replace(/[\s\r\n]+$/, '');

        logger.info(`Parsing constructor args: ${cleanedJson}`);
        logger.info(`Constructor args length: ${cleanedJson.length}`);

        constructorArgs = JSON.parse(cleanedJson).map((arg: string) => AztecAddress.fromString(arg));
    } catch (error) {
        logger.error(`Failed to parse constructor args`);
        logger.error(`Raw value: ${JSON.stringify(constructorArgsJson)}`);
        logger.error(`Raw value length: ${constructorArgsJson.length}`);
        logger.error(`Error: ${error}`);
        throw error;
    }

    // Reconstruct contract instance
    const votingContractAddress = AztecAddress.fromString(contractAddress);

    const instance = await getContractInstanceFromInstantiationParams(PrivateVotingContract.artifact, {
        constructorArgs,
        salt: Fr.fromString(contractSalt),
        deployer: AztecAddress.fromString(contractDeployer)
    });

    logger.info("✅ Contract instance reconstructed successfully");

    // Register the contract with the wallet
    await wallet.registerContract({ instance, artifact: PrivateVotingContract.artifact });


    // Get the contract instance from the PXE
    const votingContract = await PrivateVotingContract.at(
        votingContractAddress,
        wallet
    );


    // Define a candidate to vote for (using a Field value)
    const candidate = Fr.fromString("1"); // Voting for candidate "1"

    // First get_vote call - check initial vote count
    logger.info("Getting initial vote count...");
    const initialVoteCount = await votingContract.methods.get_vote(candidate).simulate({
        from: address
    });
    logger.info(`Initial vote count for candidate ${candidate}: ${initialVoteCount}`);

    // Cast a vote
    logger.info("Casting vote...");
    await votingContract.methods.cast_vote(candidate)
        .send({
            from: address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        })
        .wait({ timeout: timeouts.txTimeout });
    logger.info("Vote cast successfully!");

    // Second get_vote call - check updated vote count
    logger.info("Getting updated vote count...");
    const updatedVoteCount = await votingContract.methods.get_vote(candidate).simulate({
        from: address
    });
    logger.info(`Updated vote count for candidate ${candidate}: ${updatedVoteCount}`);

    logger.info(`Vote count increased from ${initialVoteCount} to ${updatedVoteCount}`);
}

main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
}); 
