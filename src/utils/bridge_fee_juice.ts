import { L1FeeJuicePortalManager } from '@aztec/aztec.js/ethereum';
import type { AztecNode } from '@aztec/aztec.js/node';
import { createEthereumChain } from '@aztec/ethereum/chain';
import { createExtendedL1Client } from '@aztec/ethereum/client';
import { Fr } from '@aztec/aztec.js/fields';
import { ProtocolContractAddress } from '@aztec/aztec.js/protocol';
import { getNonNullifiedL1ToL2MessageWitness } from '@aztec/stdlib/messaging';
import { FeeAssetHandlerAbi } from '@aztec/l1-artifacts/FeeAssetHandlerAbi';
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type { Logger } from '@aztec/foundation/log';
import { getContract } from 'viem';
import configManager from '../../config/config.js';

const MAX_POLL_ATTEMPTS = 40; // 40 * 30s = 20 minutes max

export async function bridgeL1FeeJuice(
    node: AztecNode,
    recipient: AztecAddress,
    amount: bigint,
    logger: Logger,
) {
    const { l1RpcUrl, l1ChainId } = configManager.getNetworkConfig();
    const l1PrivateKey = process.env.L1_PRIVATE_KEY;

    if (!l1PrivateKey) {
        throw new Error('L1_PRIVATE_KEY env var is required for testnet fee juice bridging. Must be a Sepolia-funded private key prefixed with 0x.');
    }

    const key = l1PrivateKey.startsWith('0x') ? l1PrivateKey : `0x${l1PrivateKey}`;
    const chain = createEthereumChain([l1RpcUrl], l1ChainId);

    logger.info(`🌉 Bridging ${amount} fee juice from L1 to ${recipient}...`);

    const l1Client = createExtendedL1Client(chain.rpcUrls, key, chain.chainInfo);
    const portal = await L1FeeJuicePortalManager.new(node, l1Client, logger);
    const tokenManager = portal.getTokenManager();

    // Check if we already have enough tokens on L1
    const balance = await tokenManager.getL1TokenBalance(l1Client.account.address);
    if (balance < amount) {
        // Mint tokens and wait for confirmation.
        // Upstream L1TokenManager.mint() doesn't wait for the tx receipt,
        // causing nonce conflicts with the subsequent approve transaction.
        logger.info(`🪙 Minting fee juice tokens on L1...`);
        const handler = getContract({
            address: tokenManager.handlerAddress!.toString() as `0x${string}`,
            abi: FeeAssetHandlerAbi,
            client: l1Client,
        });
        const mintHash = await handler.write.mint([l1Client.account.address]);
        logger.info(`⏳ Waiting for mint tx to confirm: ${mintHash}`);
        await l1Client.waitForTransactionReceipt({ hash: mintHash });
        logger.info(`✅ Mint confirmed on L1`);
    } else {
        logger.info(`💰 L1 account already has ${balance} tokens, skipping mint`);
    }

    // Create a fresh L1 client so viem picks up the current on-chain nonce.
    // The mint (or prior runs) may have incremented it beyond what the
    // original client has cached.
    const freshClient = createExtendedL1Client(chain.rpcUrls, key, chain.chainInfo);
    const freshPortal = await L1FeeJuicePortalManager.new(node, freshClient, logger);
    const claim = await freshPortal.bridgeTokensPublic(recipient, amount, false);

    logger.info(`✅ Fee juice bridged! Claim amount: ${claim.claimAmount}, message hash: ${claim.messageHash}`);
    logger.info(`⏳ Waiting for L1-to-L2 message to be available on L2...`);

    const pollInterval = 30_000;
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        const witness = await getNonNullifiedL1ToL2MessageWitness(
            node,
            ProtocolContractAddress.FeeJuice,
            Fr.fromHexString(claim.messageHash),
            claim.claimSecret,
        ).catch(() => undefined);

        if (witness) {
            logger.info(`✅ L1-to-L2 message is available on L2!`);
            return claim;
        }

        logger.info(`⏳ Message not yet available, checking again in ${pollInterval / 1000}s... (${attempt + 1}/${MAX_POLL_ATTEMPTS})`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`L1-to-L2 message not available after ${MAX_POLL_ATTEMPTS} attempts (${MAX_POLL_ATTEMPTS * 30}s)`);
}
