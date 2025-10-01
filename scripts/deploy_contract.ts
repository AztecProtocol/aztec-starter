import { PrivateVotingContract } from "../src/artifacts/PrivateVoting.js"
import { createLogger, PXE, Logger, SponsoredFeePaymentMethod, Fr } from "@aztec/aztec.js";
import { setupPXE } from "../src/utils/setup_pxe.js";
import { getSponsoredFPCInstance } from "../src/utils/sponsored_fpc.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { deploySchnorrAccount } from "../src/utils/deploy_account.js";
import { getTimeouts } from "../config/config.js";

async function main() {
    let pxe: PXE;
    let logger: Logger;

    logger = createLogger('aztec:aztec-starter');
    logger.info(`🚀 Starting contract deployment process...`);
    
    const timeouts = getTimeouts();

    // Setup PXE
    logger.info('📡 Setting up PXE connection...');
    pxe = await setupPXE();
    const nodeInfo = await pxe.getNodeInfo();
    logger.info(`📊 Connected to node`);

    // Setup sponsored FPC
    logger.info('💰 Setting up sponsored fee payment contract...');
    const sponsoredFPC = await getSponsoredFPCInstance();
    logger.info(`💰 Sponsored FPC instance obtained at: ${sponsoredFPC.address}`);

    logger.info('📝 Registering sponsored FPC contract with PXE...');
    await pxe.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
    logger.info('✅ Sponsored fee payment method configured');

    // Deploy account
    logger.info('👤 Deploying Schnorr account...');
    let accountManager = await deploySchnorrAccount(pxe);
    const wallet = await accountManager.getWallet();
    const address = await accountManager.getAddress();
    logger.info(`✅ Account deployed successfully at: ${address}`);

    // Deploy voting contract
    logger.info('🗳️  Starting voting contract deployment...');
    logger.info(`📋 Admin address for voting contract: ${address}`);

    const deployTx = PrivateVotingContract.deploy(wallet, address).send({
        from: wallet.getAddress(),
        fee: { paymentMethod: sponsoredPaymentMethod }
    });

    logger.info('⏳ Waiting for deployment transaction to be mined...');
    const votingContract = await deployTx.deployed({ timeout: timeouts.deployTimeout });
    
    logger.info(`🎉 Voting Contract deployed successfully!`);
    logger.info(`📍 Contract address: ${votingContract.address}`);
    logger.info(`👤 Admin address: ${address}`);

    // Verify deployment
    logger.info('🔍 Verifying contract deployment...');
    try {
        // Test a read operation
        logger.info('🧪 Testing contract read operation...');
        const initialVoteCount = await votingContract.methods.get_vote(Fr.fromString("1")).simulate({
            from: wallet.getAddress()
        });
        logger.info(`📊 Initial vote count for candidate 1: ${initialVoteCount}`);

    } catch (error) {
        logger.error(`❌ Contract verification failed: ${error}`);
    }

    logger.info('🏁 Deployment process completed successfully!');
    logger.info(`📋 Summary:`);
    logger.info(`   - Contract Address: ${votingContract.address}`);
    logger.info(`   - Admin Address: ${address}`);
    logger.info(`   - Sponsored FPC: ${sponsoredFPC.address}`);
}

main().catch((error) => {
    const logger = createLogger('aztec:aztec-starter');
    logger.error(`❌ Deployment failed: ${error.message}`);
    logger.error(`📋 Error details: ${error.stack}`);
    process.exit(1);
});
