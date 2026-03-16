# `get_block_header_at` broken in private functions on 4.0.0-devnet.2-patch.1

## Summary

`get_block_header_at()` always fails when called from a private function with:

```
Assertion failed: Proving membership of a block in archive failed
'anchor_block_header.last_archive.root,
 root_from_sibling_path(block_hash, witness.index, witness.path)'
```

Every historical block number fails — including block 1. The only code path that works is when `block_number == anchor_block_number`, which returns the anchor header directly without a proof.

## Affected versions

- **4.0.0-devnet.2-patch.1** (local-network and public devnet `v4-devnet-2.aztec-labs.com`)
- **Not affected**: 3.0.0-devnet.6-patch.1 (same pattern works correctly)

## Reproduction

```bash
# Start local network
aztec start --local-network

# Run the repro (no contract deployment needed)
yarn repro:block-header

# Or against devnet
AZTEC_ENV=devnet yarn repro:block-header
```

See [`scripts/repro_block_header.ts`](./repro_block_header.ts) for the self-contained reproduction script.

## Root cause

Off-by-one error in the node's `#getWorldState()` method when resolving a `BlockHash` parameter.

### How the Noir oracle flow works

1. Contract calls `get_block_header_at(target_block, context)` ([`aztec-nr/aztec/src/oracle/block_header.nr:12`](https://github.com/AztecProtocol/aztec-packages/blob/v4.0.0-devnet.2-patch.1/noir-projects/aztec-nr/aztec/src/oracle/block_header.nr#L12))
2. Noir fetches the target header via oracle and computes `block_hash = header.hash()`
3. Noir requests a membership witness by calling `get_block_hash_membership_witness(anchor_block_header, block_hash)` ([`aztec-nr/aztec/src/oracle/get_membership_witness.nr:48`](https://github.com/AztecProtocol/aztec-packages/blob/v4.0.0-devnet.2-patch.1/noir-projects/aztec-nr/aztec/src/oracle/get_membership_witness.nr#L48)), which passes `anchor_block_header.hash()` to the node
4. Noir verifies the proof against `anchor_block_header.last_archive.root` ([`aztec-nr/aztec/src/oracle/block_header.nr:63`](https://github.com/AztecProtocol/aztec-packages/blob/v4.0.0-devnet.2-patch.1/noir-projects/aztec-nr/aztec/src/oracle/block_header.nr#L63)):
   ```noir
   assert_eq(
       anchor_block_header.last_archive.root,
       root_from_sibling_path(block_hash, witness.index, witness.path),
       "Proving membership of a block in archive failed",
   );
   ```

### Where it goes wrong

The PXE forwards the `anchor_block_hash` to the node's `getBlockHashMembershipWitness` RPC ([`pxe/src/contract_function_simulator/oracle/utility_execution_oracle.nr:176`](https://github.com/AztecProtocol/aztec-packages/blob/v4.0.0-devnet.2-patch.1/yarn-project/pxe/src/contract_function_simulator/oracle/utility_execution_oracle.ts#L176)).

The node resolves the `BlockHash` in `#getWorldState()` ([`aztec-node/src/aztec-node/server.ts:1565-1578`](https://github.com/AztecProtocol/aztec-packages/blob/v4.0.0-devnet.2-patch.1/yarn-project/aztec-node/src/aztec-node/server.ts#L1565)):

```typescript
if (BlockHash.isBlockHash(block)) {
    const header = await this.blockSource.getBlockHeaderByHash(block);
    const blockNumber = header.getBlockNumber();
    return this.worldStateSynchronizer.getSnapshot(blockNumber); // ← BUG
}
```

- `getSnapshot(N)` returns the world state **after** block N is applied — the archive tree contains blocks 0..N.
- But `anchor_block_header.last_archive.root` is the archive root **before** block N — the archive tree containing blocks 0..N-1.
- These are different tree states with different roots, so the sibling path from `getSnapshot(N)` never matches `last_archive.root`.

### Evidence from the repro script

```
Anchor block: 57866  (devnet)

getSnapshot(57866) → archive root: 0x11d458...  (post-block, 57867 leaves)
getSnapshot(57865) → archive root: 0x19dd20...  (pre-block, 57866 leaves) ← what Noir expects

last_archive.root in anchor header: 0x19dd20...  ✓ matches getSnapshot(57865)
```

## Suggested fix

In [`yarn-project/aztec-node/src/aztec-node/server.ts`](https://github.com/AztecProtocol/aztec-packages/blob/v4.0.0-devnet.2-patch.1/yarn-project/aztec-node/src/aztec-node/server.ts), `#getWorldState()`:

```diff
 if (BlockHash.isBlockHash(block)) {
     const header = await this.blockSource.getBlockHeaderByHash(block);
     const blockNumber = header.getBlockNumber();
-    return this.worldStateSynchronizer.getSnapshot(blockNumber);
+    return this.worldStateSynchronizer.getSnapshot(blockNumber - 1);
 }
```

This aligns the snapshot with `last_archive` semantics: block N's `last_archive` is the archive state after block N-1.

> **Note**: This fix may affect other callers of `#getWorldState` that pass a `BlockHash`. Each call site should be audited to confirm whether it expects pre-block or post-block state. The `getNoteHashMembershipWitness` and `getNullifierMembershipWitness` oracles also pass through `#getWorldState` with a `BlockHash`, but they check against tree roots inside `anchor_block_header.state` (which is the state at the _end_ of the anchor block), so they may need the current `getSnapshot(N)` behavior. A targeted fix for the archive tree case — either in the oracle layer or as a separate code path in `#getWorldState` — may be safer than a blanket change.
