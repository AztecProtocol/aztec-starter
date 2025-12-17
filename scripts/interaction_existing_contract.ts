import { Logger, createLogger } from "@aztec/aztec.js/log";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { Fr } from "@aztec/aztec.js/fields";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { PodRacingContract } from "../src/artifacts/PodRacing.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { setupWallet } from "../src/utils/setup_wallet.js";
import { getSponsoredFPCInstance } from "../src/utils/sponsored_fpc.js";
import { getAccountFromEnv } from "../src/utils/create_account_from_env.js";
import { getTimeouts } from "../config/config.js";
import { getContractInstanceFromInstantiationParams } from "@aztec/aztec.js/contracts";

async function main() {
    let logger: Logger;
    logger = createLogger('aztec:pod-racing-operations-existing');

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

    // Connect to existing pod racing contract (replace with your deployed contract address)
    const contractAddress = process.env.POD_RACING_CONTRACT_ADDRESS;
    if (!contractAddress) {
        logger.error("Please set POD_RACING_CONTRACT_ADDRESS environment variable with your deployed contract address");
        return;
    }

    logger.info(`Connecting to pod racing contract at: ${contractAddress}`);
    // Get instantiation parameters from environment variables
    const contractSalt = process.env.CONTRACT_SALT;
    const contractDeployer = process.env.CONTRACT_DEPLOYER;
    const constructorArgsJson = process.env.CONTRACT_CONSTRUCTOR_ARGS;

    if (!contractSalt || !contractDeployer || !constructorArgsJson) {
        logger.error("Missing contract instantiation data in .env file");
        logger.error("Please ensure CONTRACT_SALT, CONTRACT_DEPLOYER, and CONTRACT_CONSTRUCTOR_ARGS are set");
        return;
    }

    logger.info("Reconstructing contract instance from environment variables...");

    // Parse constructor args
    let constructorArgs;
    try {
        // Clean the JSON string (handles both workflow and local usage)
        const cleanedJson = constructorArgsJson
            .trim()                           // Remove leading/trailing whitespace
            .replace(/^['"]|['"]$/g, '');     // Remove surrounding quotes from .env parsing

        constructorArgs = JSON.parse(cleanedJson).map((arg: string) => AztecAddress.fromString(arg));
    } catch (error) {
        logger.error(`Failed to parse constructor args: ${constructorArgsJson}`);
        logger.error(`Error: ${error}`);
        throw error;
    }

    // Reconstruct contract instance
    const podRacingContractAddress = AztecAddress.fromString(contractAddress);

    const instance = await getContractInstanceFromInstantiationParams(PodRacingContract.artifact, {
        constructorArgs,
        salt: Fr.fromString(contractSalt),
        deployer: AztecAddress.fromString(contractDeployer)
    });

    logger.info("✅ Contract instance reconstructed successfully");

    // Register the contract with the wallet
    await wallet.registerContract({ instance, artifact: PodRacingContract.artifact });

    // Get the contract instance from the PXE
    const podRacingContract = await PodRacingContract.at(
        podRacingContractAddress,
        wallet
    );

    // Create a new game
    const gameId = Fr.random();
    logger.info(`Creating new game with ID: ${gameId}`);

    await podRacingContract.methods.create_game(gameId)
        .send({
            from: address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        })
        .wait({ timeout: timeouts.txTimeout });
    logger.info("Game created successfully!");

    logger.info(`Game ${gameId} is now waiting for a second player to join.`);
    logger.info("To join this game, another player would call join_game with the same game ID.");
}

main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
});
