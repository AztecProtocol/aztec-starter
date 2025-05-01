#!/bin/bash

# Aztec Testnet Setup Script
# This script automates the setup and interaction with the Aztec testnet in a Docker environment.

# Exit on any error
set -e

# Define environment variables
# TODO: Verify NODE_URL and SPONSORED_FPC_ADDRESS at https://docs.aztec.network or Aztec Discord
export NODE_URL=http://34.107.66.170  # Replace with the current testnet node URL
export SPONSORED_FPC_ADDRESS=0x0b27e30667202907fc700d50e9bc816be42f8141fae8b9f2281873dbdb9fc2e5  # Verify this address
export AZTEC_VERSION=0.85.0-alpha-testnet.5

echo "Starting Aztec Testnet Setup..."

# Step 1: Prompt user to verify NODE_URL and SPONSORED_FPC_ADDRESS
echo "Using NODE_URL: $NODE_URL"
echo "Using SPONSORED_FPC_ADDRESS: $SPONSORED_FPC_ADDRESS"
echo "Please verify these values at https://docs.aztec.network or Aztec Discord."
echo "Press Enter to continue or Ctrl+C to cancel and update the values."
read -r

# Step 2: Check prerequisites
echo "Checking prerequisites..."
if ! command -v curl &> /dev/null; then
    echo "Error: curl is not installed. Please install curl and try again."
    exit 1
fi
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker and try again."
    exit 1
fi

# Check Docker resources
echo "Checking Docker resources..."
if docker info --format '{{.NCPU}} CPUs, {{.MemTotal}} memory' >/dev/null 2>&1; then
    docker info --format 'Available: {{.NCPU}} CPUs, {{.MemTotal}} memory'
else
    echo "Warning: Unable to check Docker resources. Ensure at least 2 CPUs and 4GB memory."
    docker info --format 'Docker version: {{.ServerVersion}}' || echo "Error: Docker info unavailable."
fi

# Step 3: Test NODE_URL connectivity
echo "Testing NODE_URL connectivity..."
if curl -s --head "$NODE_URL" | head -n 1 | grep "200" >/dev/null; then
    echo "NODE_URL is reachable."
else
    echo "Error: NODE_URL ($NODE_URL) is not reachable."
    echo "Verify the URL at https://docs.aztec.network or ask on Aztec Discord (https://discord.gg/aztec)."
    exit 1
fi

# Step 4: Install Aztec CLI
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

# Step 5: Install specific testnet version
echo "Installing Aztec testnet version $AZTEC_VERSION..."
aztec-up alpha-testnet || {
    echo "Error: Failed to install testnet version $AZTEC_VERSION. Check version compatibility at https://docs.aztec.network."
    exit 1
}

# Step 6: Create a new account
echo "Creating a new account..."
aztec-wallet create-account \
    --register-only \
    --node-url $NODE_URL \
    --alias my-wallet || {
    echo "Error: Failed to create account. Check NODE_URL ($NODE_URL) and network connectivity."
    exit 1
}

# Step 7: Register account with fee sponsor contract
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

# Step 8: Deploy the account with sponsored fee payment
echo "Deploying account with fee sponsor..."
if aztec-wallet deploy-account \
    --node-url $NODE_URL \
    --from my-wallet \
    --payment-method fpc-sponsored,fpc=contracts:sponsoredfpc \
    --register-class; then
    echo "Account deployed successfully with fee sponsor."
else
    echo "Warning: Failed to deploy account with fee sponsor (possibly insufficient fee payer balance)."
    echo "Retrying without fee sponsor. Ensure your wallet (my-wallet) has testnet funds."
    echo "Check for a testnet faucet at https://docs.aztec.network or request funds on Aztec Discord (https://discord.gg/aztec)."
    echo "To view your wallet address: aztec-wallet list-accounts"
    if aztec-wallet deploy-account \
        --node-url $NODE_URL \
        --from my-wallet \
        --register-class; then
        echo "Account deployed successfully without fee sponsor."
    else
        echo "Error: Failed to deploy account. Possible causes:"
        echo "1. Insufficient funds in my-wallet (request testnet funds)."
        echo "2. Invalid NODE_URL ($NODE_URL)."
        echo "3. Network congestion or server issues (Error 500)."
        echo "Note: If you see 'Timeout awaiting isMined', the transaction may still be pending."
        echo "Visit https://docs.aztec.network or join Aztec Discord (https://discord.gg/aztec) for support."
        exit 1
    fi
fi

# Step 9: Deploy a token contract
echo "Deploying token contract..."
if aztec-wallet deploy \
    --node-url $NODE_URL \
    --from accounts:my-wallet \
    --payment-method fpc-sponsored,fpc=contracts:sponsoredfpc \
    --alias token \
    TokenContract \
    --args accounts:my-wallet Token TOK 18; then
    echo "Token contract deployed successfully."
else
    echo "Error: Failed to deploy token contract. Check previous steps or fee sponsor."
    exit 1
fi

# Step 10: Mint 10 private tokens
echo "Minting 10 private tokens..."
aztec-wallet send mint_to_private \
    --node-url $NODE_URL \
    --from accounts:my-wallet \
    --payment-method fpc-sponsored,fpc=contracts:sponsoredfpc \
    --contract-address last \
    --args accounts:my-wallet accounts:my-wallet 10 || {
    echo "Error: Failed to mint private tokens. Check contract deployment or fee sponsor."
    exit 1
}

# Step 11: Transfer 2 private tokens to public
echo "Transferring 2 private tokens to public..."
aztec-wallet send transfer_to_public \
    --node-url $NODE_URL \
    --from accounts:my-wallet \
    --payment-method fpc-sponsored,fpc=contracts:sponsoredfpc \
    --contract-address last \
    --args accounts:my-wallet accounts:my-wallet 2 0 || {
    echo "Error: Failed to transfer tokens to public. Check previous steps."
    exit 1
}

# Step 12: Check private balance
echo "Checking private balance..."
aztec-wallet simulate balance_of_private \
    --node-url $NODE_URL \
    --from my-wallet \
    --contract-address last \
    --args accounts:my-wallet || {
    echo "Error: Failed to check private balance. Expected 8n."
    exit 1
}

# Step 13: Check public balance
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
echo "For further assistance, visit https://docs.aztec.network or join the Aztec Discord (https://discord.gg/aztec)."
