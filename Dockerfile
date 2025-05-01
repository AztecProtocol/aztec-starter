# Base image
FROM ubuntu:22.04

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    bash \
    nodejs \
    npm \
    ca-certificates \
    gnupg \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# Add Docker GPG key and repo
RUN mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker CLI (no daemon)
RUN apt-get update && apt-get install -y \
    docker-ce-cli \
    containerd.io \
    && rm -rf /var/lib/apt/lists/*

# Copy setup script
COPY aztec-testnet-setup.sh /aztec-testnet-setup.sh

# Make it executable
RUN chmod +x /aztec-testnet-setup.sh

# Set working directory
WORKDIR /

# Run the script when container starts
CMD ["/bin/bash", "/aztec-testnet-setup.sh"]
