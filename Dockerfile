# Use a lightweight Ubuntu base image
FROM ubuntu:22.04

# Install dependencies (curl, Node.js, Docker, and other required tools)
RUN apt-get update && apt-get install -y \
    curl \
    bash \
    nodejs \
    npm \
    ca-certificates \
    gnupg \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# Add Docker’s official GPG key and repository
RUN mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
RUN apt-get update && apt-get install -y \
    docker-ce \
    docker-ce-cli \
    containerd.io \
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
