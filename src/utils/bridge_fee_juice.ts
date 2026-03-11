import { L1FeeJuicePortalManager } from '@aztec/aztec.js/ethereum';
import type { AztecNode } from '@aztec/aztec.js/node';
import { createEthereumChain } from '@aztec/ethereum/chain';
import { createExtendedL1Client } from '@aztec/ethereum/client';
import { Fr } from '@aztec/aztec.js/fields';
import { ProtocolContractAddress } from '@aztec/aztec.js/protocol';
import { getNonNullifiedL1ToL2MessageWitness } from '@aztec/stdlib/messaging';
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type { Logger } from '@aztec/foundation/log';
import configManager from '../../config/config.js';

export async function bridgeL1FeeJuice(
    node: AztecNode,
    recipient: AztecAddress,
    amount: bigint,
    logger: Logger,
) {
    const l1RpcUrl = configManager.getConfig().network.l1RpcUrl;
    const l1ChainId = configManager.getConfig().network.l1ChainId;
    const l1PrivateKey = process.env.L1_PRIVATE_KEY;

    if (!l1PrivateKey) {
        throw new Error('L1_PRIVATE_KEY env var is required for testnet fee juice bridging. Must be a Sepolia-funded private key prefixed with 0x.');
    }

    const key = l1PrivateKey.startsWith('0x') ? l1PrivateKey : `0x${l1PrivateKey}`;
    const chain = createEthereumChain([l1RpcUrl], l1ChainId);
    const l1Client = createExtendedL1Client(chain.rpcUrls, key, chain.chainInfo);

    logger.info(`🌉 Bridging ${amount} fee juice from L1 to ${recipient}...`);

    const portal = await L1FeeJuicePortalManager.new(node, l1Client, logger);
    const claim = await portal.bridgeTokensPublic(recipient, amount, true /* mint */);

    logger.info(`✅ Fee juice bridged! Claim amount: ${claim.claimAmount}, message hash: ${claim.messageHash}`);
    logger.info(`⏳ Waiting for L1-to-L2 message to be available on L2...`);

    // Poll until the message is available on L2
    const pollInterval = 30_000;
    let witness;
    while (!witness) {
        witness = await getNonNullifiedL1ToL2MessageWitness(
            node,
            ProtocolContractAddress.FeeJuice,
            Fr.fromHexString(claim.messageHash),
            claim.claimSecret,
        ).catch(() => undefined);

        if (!witness) {
            logger.info(`⏳ Message not yet available, checking again in ${pollInterval / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
    }

    logger.info(`✅ L1-to-L2 message is available on L2!`);
    return claim;
}
