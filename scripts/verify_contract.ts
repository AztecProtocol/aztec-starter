#!/usr/bin/env node

/**
 * Script to verify a deployed Aztec contract on AztecScan
 * 
 * Usage:
 *   yarn verify-contract
 *   node --loader ts-node/esm scripts/verify_contract.ts
 */

import { verifyContract, DeployerMetadata } from "../src/utils/verify_contract.js";
import { join } from 'path';
import { createLogger } from "@aztec/aztec.js";

const logger = createLogger('aztec:verify-script');

async function main() {
    // Configuration - Update these values for your specific deployment
    const CONTRACT_ADDRESS = "0x2ce10597417f60b77f8dd2cdfc9138c418f317acf54754dde397a8b8a569d23a";
    const DEPLOYMENT_SALT = "0x0d50e9616a92a7ad33e0a5075d6c2ce68ee488bc0910497f427135f25a552ba7";
    const DEPLOYER_ADDRESS = "0x204a9adfa07d063792ce737d3164b86a016584d53cb2fede795d00659e1f94cc";
    const PUBLIC_KEYS_STRING = "" // your-public-keys-string-here for account contracts
    const CONSTRUCTOR_ARGS = ["0x204a9adfa07d063792ce737d3164b86a016584d53cb2fede795d00659e1f94cc"]; // Update with actual constructor arguments

    // Path to your compiled contract artifact
    const artifactPath = join(process.cwd(), 'target', 'easy_private_voting_contract-EasyPrivateVoting.json');

    // Deployer metadata - Update with your information
    const metadata: DeployerMetadata = {
        contractIdentifier: "EasyPrivateVoting",
        details: "A private voting contract that allows users to cast votes privately using Aztec's privacy features",
        creatorName: "Your Name", // Update with your name
        creatorContact: "your.email@example.com", // Update with your contact
        appUrl: "https://your-voting-app.com", // Optional: Your app URL
        repoUrl: "https://github.com/your-username/aztec-starter", // Update with your repo
        contractType: null
    };

    try {
        logger.info('🚀 Starting contract verification...');
        logger.info(`📍 Contract Address: ${CONTRACT_ADDRESS}`);
        logger.info(`📋 Contract: ${metadata.contractIdentifier}`);

        const result = await verifyContract({
            contractAddress: CONTRACT_ADDRESS,
            artifactPath,
            salt: DEPLOYMENT_SALT,
            deployer: DEPLOYER_ADDRESS,
            publicKeysString: PUBLIC_KEYS_STRING,
            constructorArgs: CONSTRUCTOR_ARGS,
            metadata,
            // Optional: customize API settings
            // apiBaseUrl: "https://api.testnet.aztecscan.xyz/v1/temporary-api-key",
            // apiKey: process.env.AZTEC_SCAN_API_KEY,
            // timeout: 60000
        });

        logger.info('🎉 Contract verification completed successfully!');
        logger.info(`📊 Result: ${JSON.stringify(result, null, 2)}`);

    } catch (error) {
        logger.error(`❌ Contract verification failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

export { main as verifyContractScript };
