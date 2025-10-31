import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { getAztecNodeUrl } from "../config/config.js";

async function main() {

    const nodeUrl = getAztecNodeUrl();
    const node = createAztecNodeClient(nodeUrl);
    let block = await node.getBlock(1);
    console.log(block)
    console.log(await block?.hash())
}

main();
