# Use a lightweight Ubuntu base image
FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Install Docker
RUN curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh

# Start Docker daemon in the background
RUN service docker start

# Copy the setup script
COPY aztec-testnet-setup.sh /aztec-testnet-setup.sh

# Make the script executable
RUN chmod +x /aztec-testnet-setup.sh

# Set working directory
WORKDIR /

# Run the script
CMD ["/bin/bash", "/aztec-testnet-setup.sh"]
