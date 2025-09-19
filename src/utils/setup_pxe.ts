
import { createPXEService, getPXEServiceConfig } from '@aztec/pxe/server';
import { createStore } from "@aztec/kv-store/lmdb"
import { createAztecNodeClient, waitForPXE } from '@aztec/aztec.js';

const { NODE_URL = 'http://localhost:8080' } = process.env;

const storeCache = new Map<string, Awaited<ReturnType<typeof createStore>>>();

async function getStore(label: string) {
    let store = storeCache.get(label);
    if (!store) {
        store = await createStore(label, {
            dataDirectory: 'store',
            dataStoreMapSizeKB: 1e6,
        });
        storeCache.set(label, store);
    }
    return store;
}

export const setupPXE = async (storeLabel = 'pxe') => {
    const node = createAztecNodeClient(NODE_URL);
    try {
        await node.getNodeInfo();
    } catch (error) {
        throw new Error('need to run a sandbox');
    }

    const l1Contracts = await node.getL1ContractAddresses();
    const config = getPXEServiceConfig();
    const fullConfig = { ...config, l1Contracts, proverEnabled: false };

    const store = await getStore(storeLabel);
    const pxe = await createPXEService(node, fullConfig, { store });
    await waitForPXE(pxe);
    return pxe;
};
