import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { getAztecNodeUrl } from '../../config/config.js';
import { EmbeddedWallet } from '@aztec/wallets/embedded';
import configManager from '../../config/config.js';

export async function setupWallet(): Promise<EmbeddedWallet> {
    const nodeUrl = getAztecNodeUrl();
    const node = createAztecNodeClient(nodeUrl);
    // Real proofs required on devnet/testnet (fake proofs are rejected).
    // Disabled on local network for faster iteration.
    const proverEnabled = !configManager.isLocalNetwork();
    const wallet = await EmbeddedWallet.create(node, {
        ephemeral: true,
        pxeConfig: { proverEnabled },
    });
    return wallet;
}
