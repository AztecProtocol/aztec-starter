import { PodRacingContract } from "../src/artifacts/PodRacing.js"
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { setupWallet } from "../src/utils/setup_wallet.js";
import { getSponsoredFPCInstance } from "../src/utils/sponsored_fpc.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { deploySchnorrAccount } from "../src/utils/deploy_account.js";
import { getTimeouts } from "../config/config.js";

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
    await wallet.registerContract(sponsoredFPC, SponsoredFPCContract.artifact);
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

    const deployMethod = PodRacingContract.deploy(wallet, address).send({
        from: address,
        fee: { paymentMethod: sponsoredPaymentMethod }
    });

    logger.info('⏳ Waiting for deployment transaction to be mined...');
    const podRacingContract = await deployMethod.deployed({ timeout: timeouts.deployTimeout });

    logger.info(`🎉 Pod Racing Contract deployed successfully!`);
    logger.info(`📍 Contract address: ${podRacingContract.address}`);
    logger.info(`👤 Admin address: ${address}`);

    // Verify deployment
    logger.info('🔍 Verifying contract deployment...');
    logger.info('✅ Contract deployed and ready for game creation');

    // Get contract instance for instantiation data
    const instance = await deployMethod.getInstance();
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
