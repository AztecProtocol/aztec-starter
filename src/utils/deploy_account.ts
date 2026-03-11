import { SponsoredFeePaymentMethod, FeeJuicePaymentMethodWithClaim } from "@aztec/aztec.js/fee";
import { getSponsoredFPCInstance } from "./sponsored_fpc.js";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { Fr } from "@aztec/aztec.js/fields";
import { GrumpkinScalar } from "@aztec/foundation/curves/grumpkin";
import { type Logger, createLogger } from "@aztec/foundation/log";
import { setupWallet } from "./setup_wallet.js";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { EmbeddedWallet } from "@aztec/wallets/embedded";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import configManager, { getAztecNodeUrl, getTimeouts } from "../../config/config.js";
import { bridgeL1FeeJuice } from "./bridge_fee_juice.js";

const FEE_JUICE_AMOUNT = 1_000_000_000_000n; // 1e12

export async function deploySchnorrAccount(wallet?: EmbeddedWallet): Promise<AccountManager> {
    let logger: Logger;
    logger = createLogger('aztec:aztec-starter');
    logger.info('👤 Starting Schnorr account deployment...');

    // Generate account keys
    logger.info('🔐 Generating account keys...');
    let secretKey = Fr.random();
    let signingKey = GrumpkinScalar.random();
    let salt = Fr.random();
    logger.info(`Save the following SECRET and SALT in .env for future use.`);
    logger.info(`🔑 Secret key generated: ${secretKey.toString()}`);
    logger.info(`🖊️ Signing key generated: ${signingKey.toString()}`);
    logger.info(`🧂 Salt generated: ${salt.toString()}`);

    const activeWallet = wallet ?? await setupWallet()
    const account = await activeWallet.createSchnorrAccount(secretKey, salt, signingKey)
    logger.info(`📍 Account address will be: ${account.address}`);

    const deployMethod = await account.getDeployMethod();
    const timeouts = getTimeouts();

    let paymentMethod;

    if (configManager.isTestnet()) {
        // Testnet: bridge fee juice from L1 and use it to pay for deployment
        logger.info('💰 Bridging fee juice from Sepolia L1 for account deployment...');
        const node = createAztecNodeClient(getAztecNodeUrl());
        const claim = await bridgeL1FeeJuice(node, account.address, FEE_JUICE_AMOUNT, logger);
        paymentMethod = new FeeJuicePaymentMethodWithClaim(account.address, claim);
        logger.info('✅ Fee juice claim ready for account deployment');
    } else {
        // Devnet/local: use sponsored FPC
        logger.info('💰 Setting up sponsored fee payment for account deployment...');
        const sponsoredFPC = await getSponsoredFPCInstance();
        logger.info(`💰 Sponsored FPC instance obtained at: ${sponsoredFPC.address}`);

        logger.info('📝 Registering sponsored FPC contract with PXE...');
        await activeWallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
        paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
        logger.info('✅ Sponsored fee payment method configured for account deployment');
    }

    // Simulate before sending to surface revert reasons
    await deployMethod.simulate({
        from: AztecAddress.ZERO,
    });
    logger.info('✅ Simulation successful, sending deployment transaction...');

    // Deploy account
    await deployMethod.send({
        from: AztecAddress.ZERO,
        fee: { paymentMethod },
        wait: { timeout: timeouts.deployTimeout },
    });

    logger.info(`✅ Account deployment transaction successful!`);

    return account;
}
