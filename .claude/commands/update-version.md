---
description: Update the Aztec version across the entire repo, update contract and TS code, and run tests. Usage: /update-version <new-version-tag>
---

# Update Aztec Version

Update all Aztec version references, sync the MCP server, update contract and TypeScript code for API changes, and run tests.

**Version argument:** $ARGUMENTS

## Workflow

### Step 1: Determine the new version

- If a version argument is provided, use it directly (strip leading `v` if present for npm versions, keep `v` prefix for git tags)
- If no version argument, ask the user to provide one

The version has two forms:
- **npm version** (no `v` prefix): e.g. `4.1.0-devnet.1` — used in `package.json`, config JSONs, README install command, and `CLAUDE.md`
- **git tag** (with `v` prefix): e.g. `v4.1.0-devnet.1` — used in `Nargo.toml` aztec dependency tag and for MCP sync

### Step 2: Sync MCP server to new version

Call `aztec_sync_repos` with the new version tag (with `v` prefix) and `force: true`:

```
aztec_sync_repos({ version: "v<version>", force: true })
```

Then call `aztec_status()` to verify the sync succeeded. This gives the MCP server access to the new version's source code and docs — essential for the later steps.

### Step 3: Read current files

Read these files to understand current state:
- `Nargo.toml`
- `package.json`
- `config/local-network.json`
- `config/devnet.json`
- `README.md`
- `CLAUDE.md`

### Step 4: Update all version references

Use the Edit tool to update each file. Be precise — only change version strings, nothing else.

**1. `Nargo.toml`** — Update the aztec dependency tag:
```toml
aztec = { git = "https://github.com/AztecProtocol/aztec-nr/", tag = "v<VERSION>", directory = "aztec" }
```

**2. `package.json`** — Update ALL `@aztec/*` dependency versions to the new npm version (no `v` prefix). Do NOT change non-aztec dependencies.

**3. `config/local-network.json`** — Update `settings.version` to the new npm version.

**4. `config/devnet.json`** — Update `settings.version` to the new npm version.

**5. `README.md`** — Update the install command version in the Getting Started section:
```bash
export VERSION=<NEW_VERSION>
curl -fsSL "https://install.aztec.network/${VERSION}" | VERSION="${VERSION}" bash -s
```

**6. `CLAUDE.md`** — Update the `**Aztec version: ...**` line to reflect the new version.

### Step 5: Verify version references

After all edits, grep the repo for the OLD version string to check for any missed references:

```bash
grep -r "<OLD_VERSION>" --include="*.toml" --include="*.json" --include="*.md" .
```

Report any remaining occurrences (excluding `node_modules`, `target`, `.git`).

### Step 6: Upgrade the Aztec CLI

Run `aztec-up install <VERSION>` (npm version, no `v` prefix) to upgrade the local aztec toolchain (CLI, nargo, bb, etc.) to match the new version:

```bash
aztec-up install <VERSION>
```

Verify with `aztec --version`.

### Step 6b: Install dependencies

Run `yarn install` to pull new `@aztec/*` package versions and update `yarn.lock`.

### Step 7: Research API changes in the new version

Use the MCP tools (now synced to the new version) to research what changed. This is critical — the Aztec API frequently changes between versions.

**7a. Search for breaking changes in Noir contract APIs:**

Use `aztec_search_code` to look up current signatures and patterns for:
- Contract macros: `#[aztec]`, `#[storage]`, `#[note]`, `#[external]`, `#[initializer]`, `#[only_self]`
- Storage types: `Map`, `Owned`, `PrivateSet`, `PublicMutable`
- Note system: `NoteGetterOptions`, note delivery via `MessageDelivery`
- Test environment: `TestEnvironment`, `derive_storage_slot_in_map`
- Oracle functions: `debug_log_format`
- Core traits: `Serialize`, `Deserialize`, `Packable`, `ToField`

**7b. Search for breaking changes in TypeScript APIs:**

Use `aztec_search_code` and `aztec_search_docs` to look up current patterns for:
- Wallet setup: `EmbeddedWallet`, `createAztecNodeClient`
- Account management: `AccountManager`, `GrumpkinScalar`, Schnorr accounts
- Fee payment: `SponsoredFeePaymentMethod`, `SponsoredFPCContract`
- Contract interaction: `.simulate()`, `.send()`, `ContractDeployer`
- Protocol contracts: `getCanonicalFeeJuice`, `SPONSORED_FPC_SALT`
- Types: `Fr`, `AztecAddress`, `TxStatus`, `GasSettings`

### Step 8: Update Noir contract files

Based on the API research from Step 7, update the contract source files as needed. Read each file first, then apply changes.

**Files to check and update:**
- `src/main.nr` — Main contract (imports, macros, storage declarations, function signatures, note handling, message delivery)
- `src/race.nr` — Race struct (trait implementations, serialization)
- `src/game_round_note.nr` — GameRoundNote (note macro, trait implementations)
- `src/test/utils.nr` — Test setup helper (TestEnvironment API)
- `src/test/helpers.nr` — Test helpers (TestEnvironment API)
- `src/test/pod_racing.nr` — TXE unit tests (test API, storage slot derivation)

**Common breaking changes to watch for:**
- Import path changes (e.g. `aztec::protocol::address` vs `aztec::address`)
- Macro attribute changes or new required attributes
- Storage type API changes (constructor, read/write methods)
- Note trait requirements or macro changes
- TestEnvironment method signature changes
- Trait rename/restructure (Packable, Serialize, etc.)

### Step 9: Compile the contract

Run `yarn compile` to compile the Noir contract with the new Aztec version.

If compilation fails, read the error messages carefully and fix the contract code. Use `aztec_search_code` and `aztec_search_docs` to look up correct patterns for the new version. Iterate until compilation succeeds.

Then run `yarn codegen` to regenerate the TypeScript artifacts from the compiled contract.

### Step 10: Update TypeScript files

Based on the API research from Step 7 and any changes revealed by `yarn codegen`, update TypeScript files as needed.

**Utility files (update first — other files depend on these):**
- `src/utils/setup_wallet.ts` — Wallet creation, PXE setup
- `src/utils/create_account_from_env.ts` — Account creation from env vars
- `src/utils/deploy_account.ts` — Account deployment with fees
- `src/utils/sponsored_fpc.ts` — SponsoredFPC setup
- `config/config.ts` — Config manager

**E2E test files:**
- `src/test/e2e/index.test.ts` — Full game lifecycle tests
- `src/test/e2e/accounts.test.ts` — Account tests
- `src/test/e2e/public_logging.test.ts` — Logging tests

**Script files:**
- `scripts/deploy_contract.ts` — Contract deployment
- `scripts/deploy_account.ts` — Account deployment
- `scripts/multiple_wallet.ts` — Multi-wallet interaction
- `scripts/interaction_existing_contract.ts` — Existing contract interaction
- `scripts/profile_deploy.ts` — Transaction profiling
- `scripts/fees.ts` — Fee payment examples
- `scripts/read_debug_logs.ts` — Debug log reading
- `scripts/get_block.ts` — Block retrieval

**Common TypeScript breaking changes:**
- Import path changes (submodule paths like `@aztec/aztec.js/fee` may restructure)
- Constructor/factory method signature changes
- New required parameters on `.simulate()` or `.send()`
- Type renames or moved exports
- Fee payment API changes

### Step 11: Run Noir TXE tests

Run `yarn test:nr` to execute the Noir unit tests in the TXE simulator (no network needed).

If tests fail, diagnose and fix the contract test code. Iterate until tests pass.

### Step 12: Run TypeScript E2E tests against local network

**Prerequisites:** The local network must already be running (`aztec start --local-network`). If it's not running, tell the user to start it and wait for confirmation before proceeding.

1. Clear stale PXE state: `rm -rf ./store`
2. Run E2E tests: `yarn test:js`

If tests fail:
- Read the error output carefully
- Fix the relevant TypeScript test or utility files
- Use `aztec_search_code` or `aztec_search_docs` to look up correct API usage for the new version
- Re-run `yarn test:js` until tests pass

### Step 13: Rebuild ONBOARDING.md

If any source files with `docs:start`/`docs:end` markers were modified, rebuild the onboarding docs:

```bash
yarn docs:build
```

Marker files: `src/main.nr`, `src/race.nr`, `src/game_round_note.nr`, `src/test/utils.nr`, `src/test/helpers.nr`, `src/test/pod_racing.nr`, `src/utils/sponsored_fpc.ts`

### Step 14: Final summary

Report:
- Old version → new version
- All files modified (version refs, contract code, TypeScript code)
- Test results (TXE and E2E)
- Any remaining issues or manual steps needed
- Remind user to verify devnet compatibility separately if needed (`yarn test::devnet`)
