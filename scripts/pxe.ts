import { PXE, waitForPXE, createAztecNodeClient } from "@aztec/aztec.js";
import { createPXEService, type PXEServiceConfig, getPXEServiceConfig } from "@aztec/pxe/server"

const setupPXE = async () => {
    const { NODE_URL = 'http://localhost:8080' } = process.env;
    const aztecNode = await createAztecNodeClient(NODE_URL);

    const config = getPXEServiceConfig();
    config.dataDirectory = 'pxe';
    
    // config.proverEnabled = true;
    // const l1Contracts = await aztecNode.getL1ContractAddresses();
    // const configWithContracts = {
    //   ...config,
    //   l1Contracts,
    // } as PXEServiceConfig;

    const pxe = await createPXEService(aztecNode, config)
    // await waitForPXE(pxe);
    return pxe;
};

async function main() {

    const pxe = await setupPXE();

    let block = await pxe.getBlock(1);
    console.log(block)
    console.log(await block?.hash())
}

main();
