
import { createPXEService, getPXEServiceConfig } from '@aztec/pxe/server';
import { createStore } from "@aztec/kv-store/lmdb";
import { createAztecNodeClient, waitForPXE } from '@aztec/aztec.js';

const { NODE_URL = 'http://localhost:8080' } = process.env;
const node = createAztecNodeClient(NODE_URL);
const l1Contracts = await node.getL1ContractAddresses();
const config = getPXEServiceConfig();
const fullConfig = { ...config, l1Contracts };
fullConfig.proverEnabled = false;

const store = await createStore('pxe', {
    dataDirectory: 'store',
    dataStoreMapSizeKB: 1e6,
});

export const setupPXE = async () => {
    const pxe = await createPXEService(node, fullConfig, {store});
    await waitForPXE(pxe);
    return pxe;
};
