import { PXE } from "@aztec/aztec.js";
import { setupPXE } from "../src/utils/setup_pxe.js";

async function main() {

    let pxe: PXE;
    pxe = await setupPXE();

    let block = await pxe.getBlock(1);
    console.log(block)
    console.log(await block?.hash())
}

main();
