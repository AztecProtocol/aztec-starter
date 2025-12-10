# Phase 1: Local Loop (Recursive Proof Demo)

This example isolates the "math risk" for the broader job workflow. It proves that one circuit can generate a proof and another circuit can recursively verify it—entirely locally, no PXE or P2P.

## Layout
- `worker_task/` – produces a proof that it knows `secret` such that `pedersen(secret) == h_expected`.
- `leader_aggregator/` – verifies the `worker_task` proof via `std::verify_proof_with_type`.
- `worker_recursive.test.ts` – TypeScript test that builds a proof with `@aztec/bb.js`, then feeds it into the aggregator circuit and verifies recursively.

## Build
Use `aztec-nargo` (or `nargo`) to compile both circuits via the local workspace manifest:

```bash
export AZTEC_NARGO=${AZTEC_NARGO:-aztec-nargo}
cd examples/recursion-local-loop
NARGO_MANIFEST_PATH=$(pwd)/Nargo.toml $AZTEC_NARGO compile --workspace --package worker_task --silence-warnings
NARGO_MANIFEST_PATH=$(pwd)/Nargo.toml $AZTEC_NARGO compile --workspace --package leader_aggregator --silence-warnings
```

> The `package.json` script `yarn recursion:build` runs both of these for you from the repo root.

After building, check the printed verification-key and proof lengths; if they change, update `HONK_VK_SIZE` and `HONK_PROOF_SIZE` in `leader_aggregator/src/main.nr` **and** in the test constants.

## Test
Run the local recursion test (no sandbox required):

```bash
yarn recursion:build
NODE_OPTIONS="--max-old-space-size=4096" yarn recursion:test
```

The test will:
1) Generate a `worker_task` proof for a simple secret and hash.
2) Deflatten the proof + verification key into field elements.
3) Feed them to `leader_aggregator` as private inputs and verify recursively.

If the test complains about array lengths, rebuild and update the constants to match your compiled artifacts.
