# Migration Guide: v1.2.0 → v2.0.2

## Overview
This guide covers breaking changes when upgrading from Aztec v1.2.0 to v2.0.2.

---

## 🔧 Quick Start

### 1. Update Dependencies

```bash
# Update package.json
yarn add @aztec/accounts@2.0.2 @aztec/aztec.js@2.0.2 @aztec/noir-contracts.js@2.0.2 @aztec/protocol-contracts@2.0.2 @aztec/pxe@2.0.2 @aztec/stdlib@2.0.2

# Update Nargo.toml
aztec = { git = "https://github.com/AztecProtocol/aztec-packages/", tag = "v2.0.2", directory = "noir-projects/aztec-nr/aztec" }

# Update sandbox
aztec-up 2.0.2
```

### 2. Update Compilation

Add post-processing step after compilation:

```bash
# package.json
"compile": "${AZTEC_NARGO:-aztec-nargo} compile && aztec-postprocess-contract"
```

---

## 💔 Breaking Changes

### 1. Account Key Management ⚠️ **CRITICAL**

**What changed:** Signing keys are now **separate** from secret keys and must be explicitly generated.

**Before (v1.2.0):**
```typescript
import { deriveSigningKey } from '@aztec/stdlib/keys';

const secretKey = Fr.random();
const signingKey = deriveSigningKey(secretKey);  // Derived from secret
const account = await getSchnorrAccount(pxe, secretKey, signingKey, salt);
```

**After (v2.0.2):**
```typescript
import { Fr, Fq } from '@aztec/aztec.js';

const secretKey = Fr.random();      // Field element (Fr)
const signingKey = Fq.random();     // Field element (Fq) - independent!
const salt = Fr.random();
const account = await getSchnorrAccount(pxe, secretKey, signingKey, salt);
```

**⚠️ Important:**
- Signing keys are **NOT derived** from secret keys anymore
- You must store **both** `SECRET` and `SIGNING_KEY` in your `.env`
- Old accounts cannot be recovered without both keys
- `deriveSigningKey()` function has been **removed**

**Environment Variables:**
```bash
# .env file must now include:
SECRET="0x..."
SIGNING_KEY="0x..."  # NEW - required!
SALT="0x..."
```

---

### 2. Transaction API - `from` Parameter

**What changed:** All transaction methods now require a `from` field in options.

**Before (v1.2.0):**
```typescript
// Deploy
await MyContract.deploy(wallet, arg1).send({ fee: { paymentMethod } }).deployed();

// Send transaction
await contract.methods.myMethod(arg).send({ fee: { paymentMethod } }).wait();

// Simulate
await contract.methods.myMethod(arg).simulate();
```

**After (v2.0.2):**
```typescript
// Deploy
await MyContract.deploy(wallet, arg1).send({
  from: wallet.getAddress(),
  fee: { paymentMethod }
}).deployed();

// Send transaction
await contract.methods.myMethod(arg).send({
  from: wallet.getAddress(),
  fee: { paymentMethod }
}).wait();

// Simulate
await contract.methods.myMethod(arg).simulate({
  from: wallet.getAddress()
});
```

---

### 3. Contract Instance API

**What changed:** Function renamed for clarity.

**Before (v1.2.0):**
```typescript
import { getContractInstanceFromDeployParams } from '@aztec/aztec.js';

const instance = await getContractInstanceFromDeployParams(artifact, { ... });
```

**After (v2.0.2):**
```typescript
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js';

const instance = await getContractInstanceFromInstantiationParams(artifact, { ... });
```

---

### 4. Token Contract API

**What changed:** `mint_to_private` no longer takes explicit `from` parameter (moved to options).

**Before (v1.2.0):**
```typescript
await token.methods.mint_to_private(fromAddress, toAddress, amount).send({ fee }).wait();
```

**After (v2.0.2):**
```typescript
await token.methods.mint_to_private(toAddress, amount).send({
  from: fromAddress,
  fee
}).wait();
```

---

### 5. Notes Query API

**What changed:** `getNotes()` now requires `contractAddress` parameter.

**Before (v1.2.0):**
```typescript
const notes = await pxe.getNotes({ txHash });
```

**After (v2.0.2):**
```typescript
const notes = await pxe.getNotes({
  txHash,
  contractAddress: contract.address
});
```

---

### 6. Noir Contract Changes

#### Hash Function
**Before (v1.2.0):**
```rust
use std::hash::pedersen_hash;
let nullifier = pedersen_hash([sender, secret]);
```

**After (v2.0.2):**
```rust
use dep::aztec::protocol_types::hash::poseidon2_hash;
let nullifier = poseidon2_hash([sender, secret]);
```

#### Import Restructuring
**Before (v1.2.0):**
```rust
use dep::aztec::prelude::{AztecAddress, Map, PublicImmutable, PublicMutable};
use dep::aztec::protocol_types::traits::{Hash, ToField};
```

**After (v2.0.2):**
```rust
use dep::aztec::protocol_types::{
    address::AztecAddress,
    hash::poseidon2_hash,
    traits::{Hash, ToField},
};
use dep::aztec::state_vars::{Map, PublicImmutable, PublicMutable};
```

---

### 7. Fee Economics

**What changed:** Fee amounts have increased significantly.

```typescript
// Adjust your fee funding amounts
const FEE_FUNDING = 1000000000000000000000n;  // Increased from 1e18 to 1e21
```

---

## ✅ Migration Checklist

- [ ] Update all Aztec package versions to 2.0.2
- [ ] Update sandbox to 2.0.2 (`aztec-up 2.0.2`)
- [ ] Add `aztec-postprocess-contract` to compile script
- [ ] Replace `deriveSigningKey()` with explicit `Fq.random()` or `Fq.fromString()`
- [ ] Update `.env` to include `SIGNING_KEY` variable
- [ ] Add `from:` parameter to all `.send()` calls
- [ ] Add `from:` parameter to all `.simulate()` calls
- [ ] Replace `getContractInstanceFromDeployParams` with `getContractInstanceFromInstantiationParams`
- [ ] Update `mint_to_private` calls (remove from parameter, add to options)
- [ ] Add `contractAddress` to `getNotes()` calls
- [ ] Replace `pedersen_hash` with `poseidon2_hash` in Noir contracts
- [ ] Update Noir imports for state vars and protocol types
- [ ] Review and adjust fee amounts
- [ ] Delete `./store` directory and restart sandbox
- [ ] Run tests to verify migration

---

## 🔍 Testing Your Migration

```bash
# Clean state
rm -rf ./store

# Restart sandbox
aztec start --sandbox

# Run tests
yarn test

# Deploy a fresh account
yarn deploy-account
```

---

## ❓ Troubleshooting

### Error: "deriveSigningKey is not a function"
Remove imports of `deriveSigningKey` and generate signing keys with `Fq.random()`.

### Error: "SIGNING_KEY environment variable is required"
Add `SIGNING_KEY` to your `.env` file. Deploy a new account to generate one.

### Error: "Transaction options are missing required parameter: from"
Add `from: wallet.getAddress()` to your `.send()` or `.simulate()` options.

### Error: "Contract instance not found" or stale data
Delete the `./store` directory and restart the sandbox.

---

## 📚 Additional Resources

- [Aztec Documentation](https://docs.aztec.network/)
- [v2.0.2 Release Notes](https://github.com/AztecProtocol/aztec-packages/releases/tag/v2.0.2)
- [Discord Community](https://discord.gg/aztec)
