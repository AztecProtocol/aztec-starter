import { PXE, waitForPXE, createPXEClient } from "@aztec/aztec.js";

const setupSandbox = async () => {
    const { PXE_URL = 'http://localhost:8080' } = process.env;
    const pxe = await createPXEClient(PXE_URL);
    await waitForPXE(pxe);
    return pxe;
};

async function main() {

    let pxe: PXE;
    pxe = await setupSandbox();

    let block = await pxe.getBlock(1);
    console.log(block)
    console.log(block?.hash())
}

main();
