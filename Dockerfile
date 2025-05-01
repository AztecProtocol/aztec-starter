# Use a lightweight Ubuntu base image
FROM ubuntu:22.04

# Install dependencies (curl, Node.js, and other required tools)
RUN apt-get update && apt-get install -y \
    curl \
    bash \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Install Aztec CLI
RUN curl -s https://install.aztec.network | bash -s -- -y

# Ensure Aztec CLI is in PATH
ENV PATH="/root/.aztec/bin:${PATH}"

# Copy the setup script
COPY aztec-testnet-setup.sh /aztec-testnet-setup.sh

# Make the script executable
RUN chmod +x /aztec-testnet-setup.sh

# Set working directory
WORKDIR /

# Run the script
CMD ["/bin/bash", "/aztec-testnet-setup.sh"]
