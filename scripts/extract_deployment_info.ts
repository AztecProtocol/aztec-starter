#!/usr/bin/env node

/**
 * Helper script to extract deployment information for contract verification
 * This script helps you gather the necessary information from your deployment
 */

import { setupPXE } from "../src/utils/setup_pxe.js";
import { createLogger, AztecAddress } from "@aztec/aztec.js";
import { readFileSync } from 'fs';
import { join } from 'path';

const logger = createLogger('aztec:extract-info');

async function extractDeploymentInfo() {
    logger.info('🔍 Extracting deployment information for verification...');

    try {
        // Setup PXE to get deployment info
        const pxe = await setupPXE();
        const nodeInfo = await pxe.getNodeInfo();

        logger.info(`📊 Node Info:`);
        logger.info(`  - L1 Chain ID: ${nodeInfo.l1ChainId}`);
        logger.info(`  - Node Version: ${nodeInfo.nodeVersion}`);

        // Check if we can load the artifact
        const artifactPath = join(process.cwd(), 'target', 'easy_private_voting_contract-EasyPrivateVoting.json');
        try {
            const artifactContent = readFileSync(artifactPath, 'utf-8');
            const artifact = JSON.parse(artifactContent);

            logger.info(`📋 Contract Artifact Info:`);
            logger.info(`  - Name: ${artifact.name}`);
            logger.info(`  - Functions: ${artifact.functions?.length || 0}`);
            logger.info(`  - File size: ${Buffer.byteLength(artifactContent, 'utf8')} bytes`);

        } catch (error) {
            logger.warn(`⚠️  Could not load artifact: ${error}`);
            logger.warn(`   Make sure you've compiled your contract with 'yarn compile'`);
        }

        logger.info(`\n📝 To verify your contract, you'll need:`);
        logger.info(`1. Contract Address - from your deployment output`);
        logger.info(`2. Deployment Salt - from your deployment output`);
        logger.info(`3. Deployer Address - the wallet address that deployed the contract`);
        logger.info(`4. Constructor Arguments - the arguments passed to the constructor`);
        logger.info(`5. Public Keys String - may be empty for some contract types`);

        logger.info(`\n💡 Tips for finding this information:`);
        logger.info(`- Check your deployment script output logs`);
        logger.info(`- Look for lines containing "Contract Salt:", "Contract deployer:", etc.`);
        logger.info(`- The deployer address is usually your wallet address`);
        logger.info(`- Constructor args are what you passed to the deploy method`);

        // Example of how to get public keys if you have a wallet
        logger.info(`\n🔑 To get public keys from a wallet (if needed):`);
        logger.info(`const wallet = await accountManager.getWallet();`);
        logger.info(`const publicKeys = wallet.getPublicKeys();`);
        logger.info(`const publicKeysString = publicKeys.toString();`);

    } catch (error) {
        logger.error(`❌ Failed to extract deployment info: ${error}`);
        process.exit(1);
    }
}

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
    extractDeploymentInfo().catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

export { extractDeploymentInfo };
