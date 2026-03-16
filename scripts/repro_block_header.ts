/**
 * Reproduction script for get_block_header_at archive membership proof failure.
 *
 * Bug: On Aztec 4.0.0-devnet.2-patch.1, calling `get_block_header_at(N)` inside a private
 * function always fails with:
 *   "Assertion failed: Proving membership of a block in archive failed"
 *
 * This script demonstrates the off-by-one bug in the node's getBlockHashMembershipWitness
 * WITHOUT needing a contract deployment — it calls the node RPC directly.
 *
 * Root cause:
 *   The Noir constraint in aztec-nr checks:
 *     anchor_block_header.last_archive.root == root_from_sibling_path(block_hash, witness)
 *
 *   `last_archive` at block N = archive tree root BEFORE block N (state after block N-1).
 *
 *   But the node's #getWorldState resolves anchor_block_hash → block N → getSnapshot(N),
 *   which returns the archive tree AFTER block N (one extra leaf). The sibling paths from
 *   these two tree states differ, so the proof always fails.
 *
 * Expected fix:
 *   In aztec-node server.ts #getWorldState, when a BlockHash is passed, the snapshot should
 *   use blockNumber - 1 (not blockNumber) to match last_archive semantics.
 *
 * Prerequisites:
 *   aztec start --local-network
 *
 * Usage:
 *   NODE_NO_WARNINGS=1 node --loader ts-node/esm scripts/repro_block_header.ts
 */
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { BlockNumber } from "@aztec/foundation/branded-types";
import { getAztecNodeUrl } from "../config/config.js";

async function main() {
  const nodeUrl = getAztecNodeUrl();
  const node = createAztecNodeClient(nodeUrl);
  const currentBlock = Number(await node.getBlockNumber());

  console.log("Aztec version: 4.0.0-devnet.2-patch.1");
  console.log(`Node URL: ${nodeUrl}`);
  console.log(`Current block: ${currentBlock}\n`);

  if (currentBlock < 3) {
    console.log("Need at least 3 blocks on-chain. Start the local network and wait a moment.");
    process.exit(1);
  }

  // Pick anchor block = current, target = current - 2 (well within archive range)
  const anchorBlockNum = currentBlock;
  const targetBlockNum = anchorBlockNum - 2;

  const anchorBlock = await node.getBlock(BlockNumber(anchorBlockNum));
  const targetBlock = await node.getBlock(BlockNumber(targetBlockNum));
  if (!anchorBlock || !targetBlock) {
    throw new Error("Could not fetch blocks from node");
  }

  const anchorBlockHash = await anchorBlock.hash();
  const targetBlockHash = await targetBlock.hash();

  console.log(`Anchor block number : ${anchorBlockNum}`);
  console.log(`Target block number : ${targetBlockNum}`);
  console.log(`Anchor block hash   : ${anchorBlockHash}`);
  console.log(`Target block hash   : ${targetBlockHash}`);
  console.log(`last_archive.root   : ${anchorBlock.header.lastArchive.root}  (pre-block ${anchorBlockNum})`);
  console.log(`archive.root        : ${anchorBlock.archive.root}  (post-block ${anchorBlockNum})`);
  console.log();

  // ---- Test 1: Query with anchor block HASH (what the Noir oracle does) ----
  console.log("=== Test 1: getBlockHashMembershipWitness(anchorBlockHash, targetBlockHash) ===");
  console.log("This is what the Noir oracle does internally.");
  console.log("The node resolves anchorBlockHash → block N → getSnapshot(N) [POST-block archive].\n");

  const witness1 = await node.getBlockHashMembershipWitness(anchorBlockHash, targetBlockHash);
  if (!witness1) {
    console.log("RESULT: witness is undefined — target block hash not found.\n");
  } else {
    console.log(`RESULT: witness returned (leaf index: ${witness1.leafIndex})`);
    console.log("But this witness is from the WRONG archive tree (post-block, not pre-block).");
    console.log("The Noir constraint will fail because the sibling path reconstructs to");
    console.log(`archive.root (${anchorBlock.archive.root}),`);
    console.log(`not last_archive.root (${anchorBlock.header.lastArchive.root}).\n`);
  }

  // ---- Test 2: Query with anchorBlockNum - 1 (what Noir actually needs) ----
  console.log("=== Test 2: getBlockHashMembershipWitness(anchorBlockNum - 1, targetBlockHash) ===");
  console.log("This uses the archive tree at block N-1, which IS the last_archive state.\n");

  const witness2 = await node.getBlockHashMembershipWitness(
    BlockNumber(anchorBlockNum - 1),
    targetBlockHash,
  );
  if (!witness2) {
    console.log("RESULT: witness is undefined — target block hash not found.\n");
  } else {
    console.log(`RESULT: witness returned (leaf index: ${witness2.leafIndex})`);
    console.log("This witness is from the CORRECT archive tree (pre-block).");
    console.log("The Noir constraint would PASS with this witness.\n");
  }

  // ---- Summary ----
  console.log("=".repeat(70));
  console.log("DIAGNOSIS: Off-by-one in aztec-node server.ts #getWorldState()");
  console.log();
  console.log("When the Noir oracle calls getBlockHashMembershipWitness with a BlockHash,");
  console.log("the node resolves it to block N and returns getSnapshot(N).");
  console.log("But anchor_block_header.last_archive is the archive state at block N-1.");
  console.log("The witness sibling paths don't match — proof always fails.");
  console.log();
  console.log("Both queries above return a witness, but they come from different tree states:");
  console.log(`  getSnapshot(${anchorBlockNum})   → archive root: ${anchorBlock.archive.root}`);
  console.log(`  getSnapshot(${anchorBlockNum - 1}) → archive root: ${anchorBlock.header.lastArchive.root}  ← what Noir expects`);
  console.log();
  console.log("Suggested fix in aztec-packages aztec-node/src/aztec-node/server.ts:");
  console.log("  In #getWorldState, when block is BlockHash:");
  console.log("    const blockNumber = header.getBlockNumber();");
  console.log("-   return this.worldStateSynchronizer.getSnapshot(blockNumber);");
  console.log("+   return this.worldStateSynchronizer.getSnapshot(blockNumber - 1);");
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
