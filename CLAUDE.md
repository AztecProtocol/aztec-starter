# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Aztec Starter — a template repo for learning Aztec smart contract development. Contains a **Pod Racing** game contract (Noir) with TypeScript scripts and tests. The contract is a two-player competitive game using private state for commit-reveal mechanics.

**Aztec version pinned:** `3.0.0-devnet.6-patch.1` (check `Nargo.toml` and `package.json` for source of truth).

## Commands

### Build
```bash
yarn compile          # Compile Noir contract (runs `aztec compile`) -> ./target/
yarn codegen          # Generate TypeScript bindings -> ./src/artifacts/PodRacing.ts
yarn compile && yarn codegen  # Full rebuild (always run both after contract changes)
```

### Test
```bash
yarn test             # Run ALL tests (Noir unit + TypeScript E2E)
yarn test:nr          # Noir unit tests only (no network needed, uses TXE)
yarn test:js          # TypeScript E2E tests only (requires local network running)
```

The `test:js` command clears `store/pxe` before running, uses Jest with ESM (`--experimental-vm-modules`), and has a 600-second test timeout. Tests run sequentially (`--runInBand`).

### Local Network (required for `test:js`, scripts, and deploy)
```bash
aztec start --local-network   # Start Aztec node + PXE + Anvil L1
rm -rf ./store                # MUST delete after restarting local network
```

### Scripts (all use `node --loader ts-node/esm`)
```bash
yarn deploy                          # Deploy account + Pod Racing contract
yarn deploy-account                  # Deploy a Schnorr account only
yarn interaction-existing-contract   # Interact with deployed contract (needs .env vars)
yarn multiple-wallet                 # Multi-PXE demo
yarn fees                            # Fee payment methods demo
yarn profile                         # Transaction profiling
yarn get-block                       # Query block data
```

### Devnet
Append `::devnet` to any script to target devnet (sets `AZTEC_ENV=devnet`):
```bash
yarn deploy::devnet
yarn test::devnet
```

### Clean
```bash
yarn clean            # Delete ./src/artifacts and ./target
yarn clear-store      # Delete ./store (PXE data)
```

## Architecture

### Two Languages, One Contract
- **Noir** (`.nr` files in `src/`) — the smart contract, compiled to ZK circuits
- **TypeScript** (`.ts` files in `scripts/`, `src/test/e2e/`, `src/utils/`) — deployment scripts, E2E tests, and utilities

### Contract Structure (`src/`)
- `main.nr` — Pod Racing contract entry point. Contains all public/private functions. Imports `mod test`, `mod game_round_note`, `mod race`.
- `race.nr` — `Race` struct with public game state (players, rounds, track scores, expiration). Key methods: `new()`, `join()`, `increment_player_round()`, `set_player_scores()`, `calculate_winner()`.
- `game_round_note.nr` — `GameRoundNote` private note storing one round's point allocation. The `#[note]` macro makes it a private state primitive.

### Key Aztec Pattern: Private-to-Public Flow
The contract demonstrates the core Aztec pattern where private functions enqueue public calls:
1. `play_round` (private) — creates encrypted `GameRoundNote`, then enqueues `validate_and_play_round` (public) to update round counter
2. `finish_game` (private) — reads player's private notes, sums totals, then enqueues `validate_finish_game_and_reveal` (public) to publish scores

Functions marked `#[only_self]` can only be called by the contract itself via `self.enqueue(...)`.

### TypeScript Side
- `config/config.ts` — Singleton `ConfigManager` that loads `config/local-network.json` or `config/devnet.json` based on `AZTEC_ENV`. Exports: `getAztecNodeUrl()`, `getTimeouts()`, `getEnv()`.
- `src/utils/setup_wallet.ts` — Creates `TestWallet` connected to the Aztec node. Enables prover on non-local environments.
- `src/utils/sponsored_fpc.ts` — Gets the canonical `SponsoredFPC` instance (salt=0) for sponsored fee payment.
- `src/utils/deploy_account.ts` — Deploys a Schnorr account with random keys using sponsored fees.
- `src/utils/create_account_from_env.ts` — Recreates an account from `SECRET`, `SIGNING_KEY`, `SALT` env vars.
- `src/artifacts/PodRacing.ts` — **Generated file, do not edit.** TypeScript bindings for the contract.

### Test Structure
**Noir tests** (`src/test/`): Use TXE (Testing eXecution Environment), no network needed.
- `utils.nr` — `setup()` deploys contract, returns `(TestEnvironment, contract_address, admin)`
- `helpers.nr` — Reusable allocation strategies and game setup helpers
- `pod_racing.nr` — Test cases. Uses `#[test]` and `#[test(should_fail)]` attributes.

**TypeScript E2E tests** (`src/test/e2e/`): Use Jest, require local network.
- `index.test.ts` — Pod Racing game lifecycle tests
- `accounts.test.ts` — Account deployment and fee payment tests

### Environment Variables (`.env`)
See `.env.example` for format. Key vars:
- `SECRET`, `SIGNING_KEY`, `SALT` — Account credentials
- `AZTEC_ENV` — `local-network` (default) or `devnet`
- `POD_RACING_CONTRACT_ADDRESS`, `CONTRACT_SALT`, `CONTRACT_DEPLOYER`, `CONTRACT_CONSTRUCTOR_ARGS` — For interacting with existing contracts

## Important Conventions

- **Node.js v22.15.0** required
- **Yarn 1.x** as package manager
- **ESM modules** — package.json has `"type": "module"`, tsconfig uses `NodeNext` module resolution
- **4-space indentation** in TypeScript
- **Do not commit** `src/artifacts/`, `target/`, `store/`, or `.env`
- After restarting the local network, always delete `./store` to avoid stale PXE data
- All transactions use `SponsoredFeePaymentMethod` for simplicity — register the FPC with `wallet.registerContract(sponsoredFPC, SponsoredFPCContract.artifact)` before use
- When modifying the contract, always run `yarn compile && yarn codegen` before testing TypeScript

## ONBOARDING.md Maintenance

This repo includes an `ONBOARDING.md` that serves as a progressive tutorial for Ethereum developers learning Aztec. **When making code changes, check if `ONBOARDING.md` references the changed code** (line numbers, function signatures, code snippets, struct definitions) and update it accordingly. Key sections that embed code:
- Phase 1 (1.3-1.6): Contract storage, public/private functions, game flow table
- Phase 2 (2.3): Noir test patterns and helpers
- Phase 5 (5.1-5.3): Guided exercises with code examples
- Appendix A: File map table
- Appendix B: Commands table
