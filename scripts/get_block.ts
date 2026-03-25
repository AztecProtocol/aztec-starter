import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { BlockNumber } from "@aztec/foundation/branded-types";
import { getAztecNodeUrl } from "../config/config.js";

async function main() {
  // docs:start:get-block
  const nodeUrl = getAztecNodeUrl();
  const node = createAztecNodeClient(nodeUrl);
  let block = await node.getBlock(BlockNumber(1));
  console.log(block?.header)
  // docs:end:get-block
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
