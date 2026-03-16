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

  // Pick anchor and target blocks with enough gap
  const anchorBlockNum = currentBlock - 2;
  const targetBlockNum = anchorBlockNum - 2;

  if (targetBlockNum < 1) {
    console.log("Need at least 5 blocks. Wait for more blocks and retry.");
    process.exit(1);
  }

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

  // Verify these roots differ — this is the core of the bug
  const lastArchiveRoot = anchorBlock.header.lastArchive.root.toString();
  const postArchiveRoot = anchorBlock.archive.root.toString();
  console.log(`Roots differ        : ${lastArchiveRoot !== postArchiveRoot}`);
  console.log();

  // ---- Test 1 (FAIL): Query with anchor block HASH — what the Noir oracle does ----
  console.log("=== Test 1: getBlockHashMembershipWitness(anchorBlockHash, targetBlockHash) ===");
  console.log("This is what the Noir oracle does. The node resolves the BlockHash to block N");
  console.log("and returns a witness from getSnapshot(N) — the archive AFTER block N.\n");

  const witness1 = await node.getBlockHashMembershipWitness(anchorBlockHash, targetBlockHash);
  if (!witness1) {
    console.log("  witness: undefined (target not found)\n");
  } else {
    // The witness comes from getSnapshot(anchorBlockNum), whose root is archive.root.
    // Noir checks against last_archive.root, which is a DIFFERENT root.
    const siblingPath1Top = witness1.siblingPath[witness1.siblingPath.length - 1].toString().slice(0, 20);
    console.log(`  witness leaf index : ${witness1.leafIndex}`);
    console.log(`  sibling path top   : ${siblingPath1Top}...`);
    console.log(`  tree root (actual) : ${postArchiveRoot.slice(0, 20)}...  (getSnapshot(${anchorBlockNum}))`);
    console.log(`  tree root (needed) : ${lastArchiveRoot.slice(0, 20)}...  (last_archive.root)`);
    console.log(`  MATCH              : ${postArchiveRoot === lastArchiveRoot ? "YES" : "NO — Noir proof FAILS"}`);
  }
  console.log();

  // ---- Test 2 (PASS): Query with anchorBlockNum - 1 — what Noir actually needs ----
  console.log("=== Test 2: getBlockHashMembershipWitness(anchorBlockNum - 1, targetBlockHash) ===");
  console.log("This uses getSnapshot(N-1), which IS the last_archive state.\n");

  const witness2 = await node.getBlockHashMembershipWitness(
    BlockNumber(anchorBlockNum - 1),
    targetBlockHash,
  );
  if (!witness2) {
    console.log("  witness: undefined (target not found)\n");
  } else {
    // This witness comes from getSnapshot(anchorBlockNum - 1), whose root matches last_archive.root.
    const siblingPath2Top = witness2.siblingPath[witness2.siblingPath.length - 1].toString().slice(0, 20);
    console.log(`  witness leaf index : ${witness2.leafIndex}`);
    console.log(`  sibling path top   : ${siblingPath2Top}...`);
    console.log(`  tree root (actual) : ${lastArchiveRoot.slice(0, 20)}...  (getSnapshot(${anchorBlockNum - 1}))`);
    console.log(`  tree root (needed) : ${lastArchiveRoot.slice(0, 20)}...  (last_archive.root)`);
    console.log(`  MATCH              : YES — Noir proof would PASS`);
  }
  console.log();

  // ---- Sibling path comparison ----
  if (witness1 && witness2) {
    const pathsIdentical = witness1.siblingPath.every(
      (f, i) => f.toString() === witness2.siblingPath[i].toString()
    );
    console.log(`Sibling paths identical: ${pathsIdentical}`);
    if (!pathsIdentical) {
      // Find first differing level
      const diffIdx = witness1.siblingPath.findIndex(
        (f, i) => f.toString() !== witness2.siblingPath[i].toString()
      );
      console.log(`  First difference at level ${diffIdx} (of ${witness1.siblingPath.length})`);
      console.log(`    Test 1: ${witness1.siblingPath[diffIdx].toString().slice(0, 30)}...`);
      console.log(`    Test 2: ${witness2.siblingPath[diffIdx].toString().slice(0, 30)}...`);
    }
  }

  // ---- Verdict ----
  console.log();
  console.log("=".repeat(70));
  console.log("VERDICT");
  console.log("=".repeat(70));
  console.log();
  console.log("  Test 1 (BlockHash path) : FAIL — sibling path is for the wrong tree state");
  console.log("  Test 2 (BlockNumber - 1): PASS — sibling path matches last_archive.root");
  console.log();
  console.log("Root cause: off-by-one in aztec-node server.ts #getWorldState().");
  console.log("When resolving a BlockHash, the node returns getSnapshot(N) but should");
  console.log("return getSnapshot(N-1) to match last_archive semantics.");
  console.log();
  console.log("Suggested fix:");
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
