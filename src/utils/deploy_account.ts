import { SponsoredFeePaymentMethod, FeeJuicePaymentMethodWithClaim } from "@aztec/aztec.js/fee";
import type { FeePaymentMethod } from "@aztec/aztec.js/fee";
import { getSponsoredFPCInstance } from "./sponsored_fpc.js";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { ProtocolContractAddress } from "@aztec/aztec.js/protocol";
import { Fr } from "@aztec/aztec.js/fields";
import { GrumpkinScalar } from "@aztec/foundation/curves/grumpkin";
import { type Logger, createLogger } from "@aztec/foundation/log";
import { setupWallet } from "./setup_wallet.js";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { NO_FROM } from "@aztec/aztec.js/account";
import { EmbeddedWallet } from "@aztec/wallets/embedded";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { deriveStorageSlotInMap } from "@aztec/stdlib/hash";
import configManager, { getAztecNodeUrl, getTimeouts } from "../../config/config.js";
import { bridgeL1FeeJuice } from "./bridge_fee_juice.js";

const FEE_JUICE_AMOUNT = 1_000_000_000_000_000_000_000n; // 1000e18 — fixed mint amount enforced by the portal

export async function deploySchnorrAccount(wallet?: EmbeddedWallet): Promise<AccountManager> {
    const logger: Logger = createLogger('aztec:aztec-starter');
    logger.info('👤 Starting Schnorr account deployment...');

    // Generate account keys
    logger.info('🔐 Generating account keys...');
    const secretKey = Fr.random();
    const signingKey = GrumpkinScalar.random();
    const salt = Fr.random();
    logger.info(`Save the following SECRET and SALT in .env for future use.`);
    logger.info(`🔑 Secret key generated: ${secretKey.toString()}`);
    logger.info(`🖊️ Signing key generated: ${signingKey.toString()}`);
    logger.info(`🧂 Salt generated: ${salt.toString()}`);

    const activeWallet = wallet ?? await setupWallet()
    const account = await activeWallet.createSchnorrAccount(secretKey, salt, signingKey)
    logger.info(`📍 Account address will be: ${account.address}`);

    const deployMethod = await account.getDeployMethod();
    const timeouts = getTimeouts();

    let paymentMethod: FeePaymentMethod | undefined;

    if (configManager.isTestnet()) {
        const node = createAztecNodeClient(getAztecNodeUrl());

        // Check if the account already has fee juice on L2
        const balanceSlot = await deriveStorageSlotInMap(new Fr(1), account.address);
        const balance = (await node.getPublicStorageAt('latest', ProtocolContractAddress.FeeJuice, balanceSlot)).toBigInt();

        if (balance > 0n) {
            logger.info(`💰 Account already has ${balance} fee juice on L2, skipping bridge`);
        } else {
            logger.info('💰 No fee juice found, bridging from Sepolia L1...');
            const claim = await bridgeL1FeeJuice(node, account.address, FEE_JUICE_AMOUNT, logger);
            paymentMethod = new FeeJuicePaymentMethodWithClaim(account.address, claim);
            logger.info('✅ Fee juice claim ready for account deployment');
        }
    } else {
        // Local: use sponsored FPC
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
        from: NO_FROM,
    });
    logger.info('✅ Simulation successful, sending deployment transaction...');

    // Deploy account
    await deployMethod.send({
        from: NO_FROM,
        wait: { timeout: timeouts.deployTimeout },
        ...(paymentMethod ? { fee: { paymentMethod } } : {}),
    });

    logger.info(`✅ Account deployment transaction successful!`);

    return account;
}
