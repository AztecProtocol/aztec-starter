
import { createPXEService, getPXEServiceConfig } from '@aztec/pxe/server';
import { createStore } from "@aztec/kv-store/lmdb"
import { createAztecNodeClient, waitForPXE } from '@aztec/aztec.js';
import { getAztecNodeUrl, getEnv } from '../../config/config.js';

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
    const nodeUrl = getAztecNodeUrl();
    const node = createAztecNodeClient(nodeUrl);
    
    try {
        await node.getNodeInfo();
    } catch (error) {
        throw new Error(`Cannot connect to node at ${nodeUrl}. ${nodeUrl.includes('localhost') ? 'Please run: aztec start --sandbox' : 'Check your connection.'}`);
    }

    const l1Contracts = await node.getL1ContractAddresses();
    const config = getPXEServiceConfig();
    const fullConfig = { 
        ...config, 
        l1Contracts, 
        proverEnabled: getEnv() !== 'sandbox' // Enable prover for non-local nodes
    };

    const store = await getStore(storeLabel);
    const pxe = await createPXEService(node, fullConfig, { store });
    await waitForPXE(pxe);
    return pxe;
};
