#!/usr/bin/env bash
set -e

echo "Activating feature 'aztec-sandbox'"

# Get options
AUTO_START="${AUTOSTART:-true}"
IMPORT_TEST_ACCOUNTS="${IMPORTTESTACCOUNTS:-true}"

# Install dependencies
echo "Installing system dependencies..."
apt-get update && apt-get install -y \
    curl \
    jq \
    git

# Install Node.js v22 if not present or version is too old
echo "Checking Node.js version..."
if ! command -v node &> /dev/null || [ $(node -v | cut -d'.' -f1 | sed 's/v//') -lt 20 ]; then
    echo "Installing Node.js v22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi

# Set HOME to /workspaces persistently for all users and shells
echo "Setting HOME to /workspaces persistently..."

# Add to profile for login shells
cat > /etc/profile.d/01_set_home.sh << 'PROFILE_EOF'
# Set HOME to /workspaces for Aztec compatibility
export HOME="/workspaces"

# Add Aztec binaries to PATH
if [ -d "/workspaces/.aztec/bin" ]; then
    export PATH="/workspaces/.aztec/bin:$PATH"
fi
PROFILE_EOF

chmod +x /etc/profile.d/01_set_home.sh

# Add to bashrc for non-login shells
cat >> /etc/bash.bashrc << 'BASHRC_EOF'

# Set HOME to /workspaces for Aztec compatibility
export HOME="/workspaces"

# Add Aztec binaries to PATH
if [ -d "/workspaces/.aztec/bin" ]; then
    export PATH="/workspaces/.aztec/bin:$PATH"
fi
BASHRC_EOF

# Create Aztec installation script that runs with correct HOME
echo "Creating Aztec installation script..."
cat > /usr/local/share/install-aztec.sh << 'EOF'
#!/usr/bin/env bash
set -e

echo "Installing Aztec tools..."

# Set HOME to /workspaces and change to that directory
export HOME="/workspaces"
cd /workspaces

# Install Aztec using the official installation script (non-interactive mode)
echo "Running Aztec installation script..."
NON_INTERACTIVE=1 bash -c "curl -s https://install.aztec.network | bash -s"

# Create .bashrc if it doesn't exist and set up PXE_URL for Codespaces
if [ ! -f ~/.bashrc ]; then
    touch ~/.bashrc
fi

if [ -n "\$CODESPACE_NAME" ] && ! grep -q "PXE_URL" ~/.bashrc; then
    echo "export PXE_URL=https://\$CODESPACE_NAME-8080.preview.\$GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN" >> ~/.bashrc
fi

echo "Aztec tools installation complete!"
EOF

chmod +x /usr/local/share/install-aztec.sh

# Create startup script for postCreateCommand
echo "Creating startup script..."
cat > /usr/local/share/aztec-sandbox-start.sh << EOF
#!/usr/bin/env bash
set -e

# Set HOME to /workspaces
export HOME="/workspaces"
cd /workspaces

# Wait for Docker to be ready
echo "Waiting for Docker to be ready..."
for i in {1..30}; do
    if docker info &> /dev/null; then
        echo "Docker is ready!"
        break
    fi
    if [ \$i -eq 30 ]; then
        echo "Timeout waiting for Docker to start. Docker may not be available."
        echo "You can manually install Aztec later by running: /usr/local/share/install-aztec.sh"
        exit 0
    fi
    echo "Docker not ready yet, waiting... (\$i/30)"
    sleep 2
done

# Add Aztec to PATH for this session
export PATH="/workspaces/.aztec/bin:\$PATH"

# Install Aztec tools if not already installed
if ! command -v aztec &> /dev/null; then
    echo "Aztec tools not found. Installing..."
    /usr/local/share/install-aztec.sh
    # Re-export PATH after installation
    export PATH="/workspaces/.aztec/bin:\$PATH"
fi

# Start the sandbox automatically if enabled
if [ "${AUTO_START}" = "true" ]; then
    echo "Starting Aztec Sandbox in background..."
    mkdir -p /workspaces/.aztec
    nohup /workspaces/.aztec/bin/aztec start --sandbox > /workspaces/.aztec/aztec-sandbox.log 2>&1 &
    echo \$! > /workspaces/.aztec/aztec-sandbox.pid
    echo "Aztec Sandbox started in background!"
    echo "Logs: /workspaces/.aztec/aztec-sandbox.log"
    echo "PID: \$(cat /workspaces/.aztec/aztec-sandbox.pid)"
else
    echo "Aztec setup complete!"
    echo "The 'aztec' command is now available in your PATH."
    echo "Run 'aztec start --sandbox' to start the sandbox manually."
fi
EOF

chmod +x /usr/local/share/aztec-sandbox-start.sh

echo "Aztec Sandbox feature installation complete!"
echo "Aztec tools will be installed when the container starts."