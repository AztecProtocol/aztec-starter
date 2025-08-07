# Contract Verification Guide

This guide explains how to verify your deployed Aztec contracts on AztecScan using the provided verification utilities.

## Overview

The verification system consists of two main files:

- `src/utils/verify_contract.ts` - Core verification utilities and functions
- `scripts/verify_contract.ts` - Ready-to-use verification script

## Quick Start

### 1. Update Configuration

Edit `scripts/verify_contract.ts` and update the following values with your actual deployment information:

```typescript
// Your deployed contract address
const CONTRACT_ADDRESS =
  "0x05b8fd49fe2979c8ae9b362471f4d75c10317ab7e8a412324cb0991e89d49d24";

// Salt used during deployment
const DEPLOYMENT_SALT =
  "0x2Bea1Dd1439C7A5C3AfBeB6c92C7c92dE8c0f98ccE1ceEDbF5c5Fa480C5ebbFC";

// Address that deployed the contract
const DEPLOYER_ADDRESS =
  "0x6016fb6eea216feA0B40d40x6016fb6eea216feA0B40d40x6016fb6eea216feA";

// Public keys string from deployment
const PUBLIC_KEYS_STRING = "your-public-keys-string-here";

// Constructor arguments used during deployment
const CONSTRUCTOR_ARGS = ["constructor-argument-1"];

// Update metadata with your information
const metadata: DeployerMetadata = {
  contractIdentifier: "EasyPrivateVoting",
  details:
    "A private voting contract that allows users to cast votes privately",
  creatorName: "Your Name",
  creatorContact: "your.email@example.com",
  appUrl: "https://your-app.com", // Optional
  repoUrl: "https://github.com/your-username/your-repo",
  contractType: null,
};
```

### 2. Run Verification

```bash
# Using yarn
yarn verify-contract

# Or directly with node
node --loader ts-node/esm scripts/verify_contract.ts
```

## Advanced Usage

### Using the Utility Functions Directly

```typescript
import {
  verifyContract,
  DeployerMetadata,
} from "./src/utils/verify_contract.js";

const metadata: DeployerMetadata = {
  contractIdentifier: "MyContract",
  details: "Contract description",
  creatorName: "Your Name",
  creatorContact: "your.email@example.com",
  repoUrl: "https://github.com/your-repo",
};

try {
  const result = await verifyContract({
    contractAddress: "0x...",
    artifactPath: "./target/contract-artifact.json",
    salt: "0x...",
    deployer: "0x...",
    publicKeysString: "...",
    constructorArgs: ["arg1", "arg2"],
    metadata,
    // Optional configuration
    apiBaseUrl: "https://api.testnet.aztecscan.xyz/v1/temporary-api-key",
    timeout: 60000,
  });

  console.log("Verification successful:", result);
} catch (error) {
  console.error("Verification failed:", error);
}
```

### Individual Functions

The utility provides several individual functions for more granular control:

```typescript
import {
  createVerificationRequest,
  sendVerificationRequest,
  validateContractAddress,
  loadArtifactJson,
} from "./src/utils/verify_contract.js";

// Validate an address
validateContractAddress("0x...");

// Load artifact JSON
const artifactJson = loadArtifactJson("./target/contract.json");

// Create verification request
const request = createVerificationRequest(metadata, deploymentArgs);

// Send verification request
const result = await sendVerificationRequest(config, request);
```

## Getting Deployment Information

### From Deploy Script Output

When you run the deploy script, it outputs important information needed for verification:

```
Contract Salt: 0x2Bea1Dd1439C7A5C3AfBeB6c92C7c92dE8c0f98ccE1ceEDbF5c5Fa480C5ebbFC
Contract deployer: 0x6016fb6eea216feA0B40d40x6016fb6eea216feA0B40d40x6016fb6eea216feA
Contract constructor args: 0x123...
```

### From PXE/Wallet

You can also retrieve deployment information programmatically:

```typescript
// Get deployer address
const deployerAddress = wallet.getAddress();

// Get public keys
const publicKeys = wallet.getPublicKeys();
const publicKeysString = publicKeys.toString();
```

## API Configuration

### Default Settings

- **API Base URL**: `https://api.testnet.aztecscan.xyz/v1/temporary-api-key`
- **Timeout**: 30 seconds
- **Headers**: `Content-Type: application/json`, `accept: */*`

### Custom Configuration

```typescript
await verifyContract({
  // ... other params
  apiBaseUrl: "https://custom-api.example.com",
  apiKey: "your-api-key", // If authentication is required
  timeout: 60000, // 60 seconds
});
```

## Error Handling

The verification script includes comprehensive error handling:

- **Address Validation**: Ensures contract addresses are properly formatted
- **Artifact Validation**: Validates that artifact JSON is well-formed
- **Network Errors**: Handles API timeouts and connection issues
- **API Errors**: Provides detailed error messages from the API response

## Troubleshooting

### Common Issues

1. **Invalid contract address format**

   - Ensure address starts with `0x` and is 66 characters long
   - Use the exact address from your deployment output

2. **Artifact file not found**

   - Make sure you've compiled your contract (`yarn compile`)
   - Check that the artifact path in the script is correct

3. **API timeout**

   - Increase the timeout value in configuration
   - Check your internet connection

4. **Invalid deployment arguments**
   - Verify salt, deployer address, and constructor args match your deployment
   - Ensure public keys string is correctly formatted

### Debug Mode

Enable detailed logging by setting the log level:

```typescript
import { createLogger } from "@aztec/aztec.js";
const logger = createLogger("aztec:verify", "debug");
```

## Security Notes

- Never commit API keys to version control
- Use environment variables for sensitive configuration
- Verify contract addresses before submitting verification requests

## Support

If you encounter issues:

1. Check the AztecScan API documentation
2. Verify your contract was deployed successfully
3. Ensure all deployment information is accurate
4. Check the Aztec Discord for community support
