import { createLogger, Fr, PXE, Logger, AccountManager, Fq } from "@aztec/aztec.js";
import { getSchnorrAccount } from '@aztec/accounts/schnorr';
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { getSponsoredFPCInstance } from "./sponsored_fpc.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";

export async function deploySchnorrAccount(pxe: PXE): Promise<AccountManager> {
    let logger: Logger;
    logger = createLogger('aztec:aztec-starter');

    logger.info('👤 Starting Schnorr account deployment...');

    // Setup sponsored FPC
    logger.info('💰 Setting up sponsored fee payment for account deployment...');
    const sponsoredFPC = await getSponsoredFPCInstance();
    logger.info(`💰 Sponsored FPC instance obtained at: ${sponsoredFPC.address}`);

    logger.info('📝 Registering sponsored FPC contract with PXE...');
    await pxe.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
    logger.info('✅ Sponsored fee payment method configured for account deployment');

    // Generate account keys
    logger.info('🔐 Generating account keys...');
    let secretKey = Fr.random();
    let signingKey = Fq.random();
    let salt = Fr.random();
    logger.info(`Save the following SECRET and SALT in .env for future use.`);
    logger.info(`🔑 Secret key generated: ${secretKey.toString()}`);
    logger.info(`🖊️ Signing key generated: ${signingKey.toString()}`);
    logger.info(`🧂 Salt generated: ${salt.toString()}`);

    // Create Schnorr account
    logger.info('🏗️  Creating Schnorr account instance...');
    let schnorrAccount = await getSchnorrAccount(pxe, secretKey, signingKey, salt);
    const accountAddress = schnorrAccount.getAddress();
    logger.info(`📍 Account address will be: ${accountAddress}`);

    // Deploy the account
    logger.info('🚀 Deploying account to the network...');
    logger.info('⏳ Waiting for account deployment transaction to be mined...');
    let tx = await schnorrAccount.deploy({
        fee: { paymentMethod: sponsoredPaymentMethod }
    }).wait({ timeout: 120000 });

    logger.info(`✅ Account deployment transaction successful!`);
    logger.info(`📋 Transaction hash: ${tx.txHash}`);

    // Get wallet instance
    logger.info('👛 Getting wallet instance...');
    let wallet = await schnorrAccount.getWallet();
    const deployedAddress = wallet.getAddress();
    logger.info(`✅ Wallet instance created for address: ${deployedAddress}`);

    // Verify deployment
    logger.info('🔍 Verifying account deployment...');
    try {
        const registeredAccounts = await pxe.getRegisteredAccounts();
        const isRegistered = registeredAccounts.some(acc => acc.address.equals(deployedAddress));

        if (isRegistered) {
            logger.info('✅ Account successfully registered with PXE');
        } else {
            logger.warn('⚠️  Account not found in registered accounts list');
        }
    } catch (error) {
        logger.error(`❌ Account verification failed: ${error}`);
    }

    logger.info('🎉 Schnorr account deployment completed successfully!');
    logger.info(`📋 Account Summary:`);
    logger.info(`   - Address: ${deployedAddress}`);
    logger.info(`   - Transaction Hash: ${tx.txHash}`);
    logger.info(`   - Fee Payment: Sponsored FPC (${sponsoredFPC.address})`);

    return schnorrAccount;
}