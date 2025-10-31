
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { getAztecNodeUrl } from '../../config/config.js';
import { TestWallet } from '@aztec/test-wallet/server';

export async function setupWallet(): Promise<TestWallet> {
    const nodeUrl = getAztecNodeUrl();
    const node = createAztecNodeClient(nodeUrl);
    const wallet = await TestWallet.create(node);
    return wallet
}
