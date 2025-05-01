#!/bin/bash

# Aztec Testnet Setup Script
# This script automates the setup and interaction with the Aztec testnet in a Docker environment.

# Exit on any error
set -e

# Define environment variables
export NODE_URL=http://34.107.66.170
export SPONSORED_FPC_ADDRESS=0x0b27e30667202907fc700d50e9bc816be42f8141fae8b9f2281873dbdb9fc2e5
export AZTEC_VERSION=0.85.0-alpha-testnet.5

echo "Starting Aztec Testnet Setup..."

# Step 1: Install Aztec CLI
echo "Installing Aztec CLI..."
curl -s https://install.aztec.network | bash -s -- -y


# Step 2: Install specific testnet version
echo "Installing Aztec testnet version $AZTEC_VERSION..."
aztec-up alpha-testnet

# Step 3: Create a new account
echo "Creating a new account..."
aztec-wallet create-account \
    --register-only \
    --node-url $NODE_URL \
    --alias my-wallet

# Step 4: Register account with fee sponsor contract
echo "Registering account with fee sponsor contract..."
aztec-wallet register-contract \
    --node-url $NODE_URL \
    --from my-wallet \
    --alias sponsoredfpc \
    $SPONSORED_FPC_ADDRESS SponsoredFPC \
    --salt 0

# Step 5: Deploy the account
echo "Deploying account..."
aztec-wallet deploy-account \
    --node-url $NODE_URL \
    --from my-wallet \
    --payment-method=fpc-sponsored,fpc=contracts:sponsoredfpc \
    --register-class

# Step 6: Deploy a token contract
echo "Deploying token contract..."
aztec-wallet deploy \
    --node-url $NODE_URL \
    --from accounts:my-wallet \
    --payment-method=fpc-sponsored,fpc=contracts:sponsoredfpc \
    --alias token \
    TokenContract \
    --args accounts:my-wallet Token TOK 18

# Step 7: Mint 10 private tokens
echo "Minting 10 private tokens..."
aztec-wallet send mint_to_private \
    --node-url $NODE_URL \
    --from accounts:my-wallet \
    --payment-method=fpc-sponsored,fpc=contracts:sponsoredfpc \
    --contract-address last \
    --args accounts:my-wallet accounts:my-wallet 10

# Step 8: Transfer 2 private tokens to public
echo "Transferring 2 private tokens to public..."
aztec-wallet send transfer_to_public \
    --node-url $NODE_URL \
    --from accounts:my-wallet \
    --payment-method=fpc-sponsored,fpc=contracts:sponsoredfpc \
    --contract-address last \
    --args accounts:my-wallet accounts:my-wallet 2 0

# Step 9: Check private balance
echo "Checking private balance..."
aztec-wallet simulate balance_of_private \
    --node-url $NODE_URL \
    --from my-wallet \
    --contract-address last \
    --args accounts:my-wallet

# Step 10: Check public balance
echo "Checking public balance..."
aztec-wallet simulate balance_of_public \
    --node-url $NODE_URL \
    --from my-wallet \
    --contract-address last \
    --args accounts:my-wallet

echo "Aztec Testnet Setup Complete!"
echo "Private balance should be 8n, and public balance should be 2n."
echo "You can now explore further with the Aztec testnet!"
