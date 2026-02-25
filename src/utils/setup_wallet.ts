import { createAztecNodeClient } from '@aztec/aztec.js/node';
import configManager, { getAztecNodeUrl } from '../../config/config.js';
import { EmbeddedWallet } from '@aztec/wallets/embedded';

export async function setupWallet(): Promise<EmbeddedWallet> {
    const nodeUrl = getAztecNodeUrl();
    const node = createAztecNodeClient(nodeUrl);
    const wallet = await EmbeddedWallet.create(node, {
        ephemeral: true,
        pxeConfig: { proverEnabled: configManager.isDevnet() },
    });
    return wallet;
}
