import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { getAztecNodeUrl } from '../../config/config.js';
import { EmbeddedWallet } from '@aztec/wallets/embedded';

export async function setupWallet(): Promise<EmbeddedWallet> {
    const nodeUrl = getAztecNodeUrl();
    const node = createAztecNodeClient(nodeUrl);
    const wallet = await EmbeddedWallet.create(node, { ephemeral: true });
    return wallet;
}
