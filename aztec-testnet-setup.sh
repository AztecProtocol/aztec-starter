#!/bin/bash

# Aztec Testnet Setup Script
# Automates setup and interaction with the Aztec testnet or Sandbox in a Docker environment.

# Exit on any error
set -e

# Define environment variables (default values, to be verified by user)
export NODE_URL=http://34.107.66.170
export SPONSORED_FPC_ADDRESS=0x0b27e30667202907fc700d50e9bc816be42f8141fae8b9f2281873dbdb9fc2e5
export AZTEC_VERSION=0.85.0-alpha-testnet.5
export PAYMENT_METHOD="fpc-sponsored,fpc=contracts:sponsoredfpc"
export SANDBOX_NODE_URL=http://localhost:8545

echo "Starting Aztec Testnet Setup..."

# Function to test NODE_URL connectivity with retries
test_node_url() {
    local url=$1
    local retries=3
    local delay=5
    local attempt=1

    while [ $attempt -le $retries ]; do
        echo "Testing NODE_URL ($url) - Attempt $attempt/$retries..."
        if curl -s --head --connect-timeout 10 "$url" | head -n 1 | grep "200" >/dev/null; then
            echo "NODE_URL is reachable."
            return 0
        else
            echo "NODE_URL ($url) is not reachable."
            if [ $attempt -lt $retries ]; then
                echo "Retrying in $delay seconds..."
                sleep $delay
            fi
            ((attempt++))
        fi
    done
    return 1
}

# Step 1: Prompt user to verify or update environment variables
echo "Default values:"
echo "- NODE_URL: $NODE_URL"
echo "- SPONSORED_FPC_ADDRESS: $SPONSORED_FPC_ADDRESS"
echo "- AZTEC_VERSION: $AZTEC_VERSION"
echo "Verify these at https://docs.aztec.network or Aztec Discord (https://discord.gg/aztec)."
echo "Press Enter to use defaults, or enter new values below."

echo "Enter NODE_URL (or press Enter to keep default):"
read -r new_node_url
if [ -n "$new_node_url" ]; then
    export NODE_URL="$new_node_url"
fi

echo "Enter SPONSORED_FPC_ADDRESS (or press Enter to keep default):"
read -r new_fpc_address
if [ -n "$new_fpc_address" ]; then
    export SPONSORED_FPC_ADDRESS="$new_fpc_address"
fi

echo "Enter AZTEC_VERSION (or press Enter to keep default):"
read -r new_version
if [ -n "$new_version" ]; then
    export AZTEC_VERSION="$new_version"
fi

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

# Check Docker daemon
echo "Checking Docker daemon..."
if ! docker info >/dev/null 2>&1; then
    echo "Docker daemon is not running. Bones to start..."
    if command -v systemctl >/dev/null; then
        sudo systemctl start docker || {
            echo "Error: Failed to start Docker. Please start Docker manually."
            exit 1
        }
    else
        echo "Error: Cannot start Docker automatically. Please start Docker manually."
        exit 1
    fi
fi

# Check Docker resources
echo "Checking Docker resources..."
if docker info --format '{{.NCPU}} CPUs, {{.MemTotal}} memory' >/dev/null 2>&1; then
    docker info --format 'Available: {{.NCPU}} CPUs, {{.MemTotal}} memory'
else
    echo "Warning: Unable to check Docker resources. Ensure at least 2 CPUs and 4GB memory."
fi

# Step 3: Test NODE_URL connectivity
if ! test_node_url "$NODE_URL"; then
    echo "Error: NODE_URL ($NODE_URL) is not reachable after retries."
    echo "Troubleshooting steps:"
    echo "1. Verify the URL at https://docs.aztec.network or ask on Aztec Discord (https://discord.gg/aztec)."
    echo "2. Check if the testnet requires partner access (contact devrel@aztecprotocol.com)."
    echo "3. Ensure your server allows outbound HTTP traffic to $NODE_URL."
    echo "   Run: curl -s --head $NODE_URL"
    echo "4. Alternatively, use the Aztec Sandbox (local development environment)."
    echo "Enter a new NODE_URL to try again, or type 'sandbox' to switch to the Sandbox:"
    read -r fallback_url
    if [ "$fallback_url" = "sandbox" ]; then
        echo "Switching to Aztec Sandbox..."
        export NODE_URL=$SANDBOX_NODE_URL
        echo "Installing and starting Aztec Sandbox..."
        aztec-up sandbox || {
            echo "Error: Failed to start Aztec Sandbox. Check Docker and https://docs.aztec.network."
            exit 1
        }
        if ! test_node_url "$NODE_URL"; then
            echo "Error: Sandbox NODE_URL ($NODE_URL) is not reachable."
            echo "Ensure the Sandbox is running (aztec-up sandbox) and Docker is configured correctly."
            exit 1
        fi
    elif [ -n "$fallback_url" ]; then
        export NODE_URL="$fallback_url"
        if ! test_node_url "$NODE_URL"; then
            echo "Error: New NODE_URL ($NODE_URL) is not reachable."
            echo "Verify the URL or use the Sandbox. Exiting."
            exit 1
        fi
    else
        echo "No new URL provided. Exiting."
        exit 1
    fi
fi

# Step 4: Install Aztec CLI
echo "Installing Aztec CLI..."
curl -s https://install.aztec.network | bash -s -- -y || {
    echo "Error: Failed to install Aztec CLI. Check network connection or https://docs.aztec.network."
    exit 1
}

# Add Aztec CLI to PATH and offer to make it permanent
export PATH="$HOME/.aztec/bin:$PATH"
if ! command -v aztec &> /dev/null; then
    echo "Error: Aztec CLI not found in PATH. Ensure $HOME/.aztec/bin exists."
    exit 1
fi
echo "Aztec CLI added to PATH for this session."
echo "Do you want to add it permanently to your shell PATH? (y/n)"
read -r add_path
if [ "$add_path" = "y" ]; then
    echo 'export PATH="$HOME/.aztec/bin:$PATH"' >> "$HOME/.bashrc"
    echo "Added to .bashrc. Run 'source ~/.bashrc' or restart your terminal."
else
    echo "Note: You may need to add 'export PATH=\"$HOME/.aztec/bin:$PATH\"' to your shell configuration (e.g., ~/.bashrc) manually."
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
    $SPONSORED_FPC_ADDRESS SponsoredFPC; then
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
    --payment-method $PAYMENT_METHOD \
    --register-class; then
    echo "Account deployed successfully with fee sponsor."
else
    echo "Warning: Failed to deploy account. If you see 'Timeout awaiting isMined', the transaction may still be pending."
    echo "Check status with: aztec-wallet list-transactions --from my-wallet"
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
    --payment-method $PAYMENT_METHOD \
    --alias token \
    TokenContract \
    --args accounts:my-wallet Token TOK 18; then
    echo "Token contract deployed successfully."
else
    echo "Warning: Failed to deploy token contract. If you see 'Timeout awaiting isMined', the transaction may still be pending."
    echo "Check status with: aztec-wallet list-transactions --from my-wallet"
    echo "Verify previous steps or fee sponsor at https://docs.aztec.network."
    exit 1
fi

# Step 10: Mint 10 private tokens
echo "Minting 10 private tokens..."
if aztec-wallet send mint_to_private \
    --node-url $NODE_URL \
    --from accounts:my-wallet \
    --payment-method $PAYMENT_METHOD \
    --contract-address last \
    --args accounts:my-wallet accounts:my-wallet 10; then
    echo "Successfully minted 10 private tokens."
else
    echo "Warning: Failed to mint private tokens. If you see 'Timeout awaiting isMined', the transaction may still be pending."
    echo "Check status with: aztec-wallet list-transactions --from my-wallet"
    echo "Verify contract deployment or fee sponsor at https://docs.aztec.network."
    exit 1
fi

# Step 11: Transfer 2 private tokens to public
echo "Transferring 2 private tokens to public..."
if aztec-wallet send transfer_to_public \
    --node-url $NODE_URL \
    --from accounts:my-wallet \
    --payment-method $PAYMENT_METHOD \
    --contract-address last \
    --args accounts:my-wallet accounts:my-wallet 2 0; then
    echo "Successfully transferred 2 private tokens to public."
else
    echo "Warning: Failed to transfer tokens to public. If you see 'Timeout awaiting isMined', the transaction may still be pending."
    echo "Check status with: aztec-wallet list-transactions --from my-wallet"
    echo "Verify previous steps at https://docs.aztec.network."
    exit 1
fi

# Step 12: Check private balance
echo "Checking private balance..."
private_balance=$(aztec-wallet simulate balance_of_private \
    --node-url $NODE_URL \
    --from my-wallet \
    --contract-address last \
    --args accounts:my-wallet 2>/dev/null || {
    echo "Error: Failed to check private balance. Verify contract deployment at https://docs.aztec.network."
    exit 1
})
if [[ "$private_balance" =~ "8n" ]]; then
    echo "Private balance: 8n (as expected)."
else
    echo "Warning: Private balance ($private_balance) does not match expected value (8n)."
    echo "Verify previous steps at https://docs.aztec.network."
fi

# Step 13: Check public balance
echo "Checking public balance..."
public_balance=$(aztec-wallet simulate balance_of_public \
    --node-url $NODE_URL \
    --from my-wallet \
    --contract-address last \
    --args accounts:my-wallet 2>/dev/null || {
    echo "Error: Failed to check public balance. Verify contract deployment at https://docs.aztec.network."
    exit 1
})
if [[ "$public_balance" =~ "2n" ]]; then
    echo "Public balance: 2n (as expected)."
else
    echo "Warning: Public balance ($public_balance) does not match expected value (2n)."
    echo "Verify previous steps at https://docs.aztec.network."
fi

echo "Aztec Testnet Setup Complete!"
echo "Private balance should be 8n, and public balance should be 2n."
echo "You can now explore further with the Aztec testnet or Sandbox!"
echo "For further assistance, visit https://docs.aztec.network or join the Aztec Discord (https://discord.gg/aztec)."
