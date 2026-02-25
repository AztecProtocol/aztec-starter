import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { PodRacingContract } from "../src/artifacts/PodRacing.js"
import { type Logger, createLogger } from "@aztec/foundation/log";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { setupWallet } from "../src/utils/setup_wallet.js";
import { getSponsoredFPCInstance } from "../src/utils/sponsored_fpc.js";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { deploySchnorrAccount } from "../src/utils/deploy_account.js";
import { getTimeouts, getAztecScanConfig } from "../config/config.js";
import { verifyArtifactOnAztecScan, verifyInstanceOnAztecScan } from "../src/utils/verify_on_aztecscan.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
    let logger: Logger;

    logger = createLogger('aztec:aztec-starter');
    logger.info(`🚀 Starting contract deployment process...`);

    const timeouts = getTimeouts();

    // Setup wallet
    logger.info('📡 Setting up wallet...');
    const wallet = await setupWallet();
    logger.info(`📊 Wallet set up successfully`);

    // Setup sponsored FPC
    logger.info('💰 Setting up sponsored fee payment contract...');
    const sponsoredFPC = await getSponsoredFPCInstance();
    logger.info(`💰 Sponsored FPC instance obtained at: ${sponsoredFPC.address}`);

    logger.info('📝 Registering sponsored FPC contract with wallet...');
    await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
    logger.info('✅ Sponsored fee payment method configured');

    // Deploy account
    logger.info('👤 Deploying Schnorr account...');
    let accountManager = await deploySchnorrAccount(wallet);
    const address = accountManager.address;
    logger.info(`✅ Account deployed successfully at: ${address}`);

    // Deploy pod racing contract
    logger.info('🏎️  Starting pod racing contract deployment...');
    logger.info(`📋 Admin address for pod racing contract: ${address}`);

    logger.info('⏳ Waiting for deployment transaction to be mined...');
    const { contract: podRacingContract, instance } = await PodRacingContract.deploy(wallet, address).send({
        from: address,
        fee: { paymentMethod: sponsoredPaymentMethod },
        wait: { timeout: timeouts.deployTimeout, returnReceipt: true }
    });

    logger.info(`🎉 Pod Racing Contract deployed successfully!`);
    logger.info(`📍 Contract address: ${podRacingContract.address}`);
    logger.info(`👤 Admin address: ${address}`);

    // Log contract instantiation data
    if (instance) {
        logger.info('📦 Contract instantiation data:');
        logger.info(`Salt: ${instance.salt}`);
        logger.info(`Deployer: ${instance.deployer}`);
        if (instance.publicKeys) {
            logger.info(`Public Keys - Master Nullifier: ${instance.publicKeys.masterNullifierPublicKey}`);
            logger.info(`Public Keys - Master Incoming Viewing: ${instance.publicKeys.masterIncomingViewingPublicKey}`);
            logger.info(`Public Keys - Master Outgoing Viewing: ${instance.publicKeys.masterOutgoingViewingPublicKey}`);
            logger.info(`Public Keys - Master Tagging: ${instance.publicKeys.masterTaggingPublicKey}`);
        }
        logger.info(`Constructor args: ${JSON.stringify([address.toString()])}`);
    }

    // Verify on AztecScan (best-effort — deploy succeeds regardless)
    const aztecscanConfig = getAztecScanConfig();
    if (aztecscanConfig && instance) {
        logger.info('🔍 Verifying contract on AztecScan...');

        const contractClassId = instance.currentContractClassId.toString();
        const publicKeysString = instance.publicKeys
            ? instance.publicKeys.toString()
            : "0x" + "0".repeat(512);
        const constructorArgs = [address.toString()];

        // Load the raw JSON artifact (Noir compiler output) — NOT the codegen'd
        // ContractArtifact. The server expects the original JSON with base64 bytecode
        // strings, snake_case keys, etc. The codegen'd artifact has Buffer objects,
        // camelCase keys, and transformed function structure that the server can't parse.
        const rawArtifactPath = join(__dirname, "../target/pod_racing_contract-PodRacing.json");
        const rawArtifact = JSON.parse(readFileSync(rawArtifactPath, "utf8"));

        try {
            // Wait for the AztecScan indexer to pick up the on-chain data
            logger.info('⏳ Waiting 15s for AztecScan indexer...');
            await new Promise(resolve => setTimeout(resolve, 15_000));

            // 1. Verify artifact (contract class)
            const artifactResult = await verifyArtifactOnAztecScan(
                aztecscanConfig,
                contractClassId,
                1,
                rawArtifact,
            );
            logger.info(`📋 Artifact verification: ${artifactResult.status} ${artifactResult.statusText}`);

            // 2. Verify instance (deployment)
            const instanceResult = await verifyInstanceOnAztecScan(
                aztecscanConfig,
                podRacingContract.address.toString(),
                {
                    publicKeysString,
                    deployer: instance.deployer.toString(),
                    salt: instance.salt.toString(),
                    constructorArgs,
                },
                rawArtifact,
            );
            logger.info(`📋 Instance verification: ${instanceResult.status} ${instanceResult.statusText}`);

            if (artifactResult.ok && instanceResult.ok) {
                logger.info('✅ Contract verified on AztecScan');
            } else {
                logger.warn('⚠️ AztecScan verification returned non-OK status (contract still deployed successfully)');
            }
        } catch (err) {
            logger.warn(`⚠️ AztecScan verification failed (contract still deployed successfully): ${err}`);
        }
    } else if (!aztecscanConfig) {
        logger.info('ℹ️ AztecScan not configured for this environment, skipping verification');
    }

    logger.info('🏁 Deployment process completed successfully!');
    logger.info(`📋 Summary:`);
    logger.info(`   - Contract Address: ${podRacingContract.address}`);
    logger.info(`   - Admin Address: ${address}`);
    logger.info(`   - Sponsored FPC: ${sponsoredFPC.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    const logger = createLogger('aztec:aztec-starter');
    logger.error(`❌ Deployment failed: ${error.message}`);
    logger.error(`📋 Error details: ${error.stack}`);
    process.exit(1);
  });
