#!/bin/bash

# Aztec Testnet Setup Script
# This script automates the setup and interaction with the Aztec testnet in a Docker environment.

# Exit on any error
set -e

# Define environment variables
# TODO: Verify NODE_URL and SPONSORED_FPC_ADDRESS at https://docs.aztec.network or Aztec Discord
export NODE_URL=http://34.107.66.170
export SPONSORED_FPC_ADDRESS=0x0b27e30667202907fc700d50e9bc816be42f8141fae8b9f2281873dbdb9fc2e5
export AZTEC_VERSION=0.85.0-alpha-testnet.5

echo "Starting Aztec Testnet Setup..."

# Step 1: Check prerequisites
echo "Checking prerequisites..."
if ! command -v curl &> /dev/null; then
    echo "Error: curl is not installed. Please install curl and try again."
    exit 1
fi
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker and try again."
    exit 1
fi

# Step 2: Install Aztec CLI
echo "Installing Aztec CLI..."
curl -s https://install.aztec.network | bash -s -- -y || {
    echo "Error: Failed to install Aztec CLI. Check network connection or https://docs.aztec.network."
    exit 1
}

# Add Aztec CLI to PATH
export PATH="$HOME/.aztec/bin:$PATH"
if ! command -v aztec &> /dev/null; then
    echo "Error: Aztec CLI not found in PATH. Ensure $HOME/.aztec/bin exists."
    exit 1
fi

# Step 3: Install specific testnet version
echo "Installing Aztec testnet version $AZTEC_VERSION..."
aztec-up alpha-testnet || {
    echo "Error: Failed to install testnet version $AZTEC_VERSION. Check version compatibility at https://docs.aztec.network."
    exit 1
}

# Step 4: Create a new account
echo "Creating a new account..."
aztec-wallet create-account \
    --register-only \
    --node-url $NODE_URL \
    --alias my-wallet || {
    echo "Error: Failed to create account. Check NODE_URL ($NODE_URL) and network connectivity."
    exit 1
}

# Step 5: Register account with fee sponsor contract
echo "Registering account with fee sponsor contract..."
if aztec-wallet register-contract \
    --node-url $NODE_URL \
    --from my-wallet \
    --alias sponsoredfpc \
    $SPONSORED_FPC_ADDRESS SponsoredFPC \
    --salt 0; then
    echo "Fee sponsor contract registered successfully."
else
    echo "Error: Failed to register fee sponsor contract. Verify SPONSORED_FPC_ADDRESS ($SPONSORED_FPC_ADDRESS)."
    exit 1
fi

# Step 6: Deploy the account with sponsored fee payment
echo "Deploying account..."
if aztec-wallet deploy-account \
    --node-url $NODE_URL \
    --from my-wallet \
    --payment method=fpc-sponsored,fpc=contracts:sponsoredfpc \
    --register-class; then
    echo "Account deployed successfully."
else
    echo "Warning: Failed to deploy account with sponsored fees. Retrying without fee sponsor..."
    if aztec-wallet deploy-account \
        --node-url $NODE_URL \
        --from my-wallet \
        --register-class; then
        echo "Account deployed successfully without fee sponsor."
    else
        echo "Error: Failed to deploy account. Check NODE_URL, wallet funds, or network status."
        echo "Note: If you see 'Timeout awaiting isMined', the transaction may still be pending."
        echo "Visit https://docs.aztec.network or Aztec Discord for support."
        exit 1
    fi
fi

# Step 7: Deploy a token contract
echo "Deploying token contract..."
if aztec-wallet deploy \
    --node-url $NODE_URL \
    --from accounts:my-wallet \
    --payment method=fpc-sponsored,fpc=contracts:sponsoredfpc \
    --alias token \
    TokenContract \
    --args accounts:my-wallet Token TOK 18; then
    echo "Token contract deployed successfully."
else
    echo "Error: Failed to deploy token contract. Check previous steps or fee sponsor."
    exit 1
fi

# Step 8: Mint 10 private tokens
echo "Minting 10 private tokens..."
aztec-wallet send mint_to_private \
    --node-url $NODE_URL \
    --from accounts:my-wallet \
    --payment method=fpc-sponsored,fpc=contracts:sponsoredfpc \
    --contract-address last \
    --args accounts:my-wallet accounts:my-wallet 10 || {
    echo "Error: Failed to mint private tokens. Check contract deployment or fee sponsor."
    exit 1
}

# Step 9: Transfer 2 private tokens to public
echo "Transferring 2 private tokens to public..."
aztec-wallet send transfer_to_public \
    --node-url $NODE_URL \
    --from accounts:my-wallet \
    --payment method=fpc-sponsored,fpc=contracts:sponsoredfpc \
    --contract-address last \
    --args accounts:my-wallet accounts:my-wallet 2 0 || {
    echo "Error: Failed to transfer tokens to public. Check previous steps."
    exit 1
}

# Step 10: Check private balance
echo "Checking private balance..."
aztec-wallet simulate balance_of_private \
    --node-url $NODE_URL \
    --from my-wallet \
    --contract-address last \
    --args accounts:my-wallet || {
    echo "Error: Failed to check private balance. Expected 8n."
    exit 1
}

# Step 11: Check public balance
echo "Checking public balance..."
aztec-wallet simulate balance_of_public \
    --node-url $NODE_URL \
    --from my-wallet \
    --contract-address last \
    --args accounts:my-wallet || {
    echo "Error: Failed to check public balance. Expected 2n."
    exit 1
}

echo "Aztec Testnet Setup Complete!"
echo "Private balance should be 8n, and public balance should be 2n."
echo "You can now explore further with the Aztec testnet!"
echo "For further assistance, visit https://docs.aztec.network or join the Aztec Discord."
