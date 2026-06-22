FROM --platform=linux/amd64 ubuntu:24.04
SHELL ["/bin/bash", "-c"]

ENV NVM_DIR=/root/.nvm
ENV NODE_VERSION=24.12.0
ARG AZTEC_VERSION=5.0.0-rc.1
ENV AZTEC_VERSION=$AZTEC_VERSION
ENV NON_INTERACTIVE=1
ENV BIN_PATH=/usr/local/bin

# Install dependencies including newer libstdc++
RUN apt update && apt install -y \
    curl \
    bash \
    git \
    tar \
    gzip \
    libc++-dev \
    libstdc++6 \
    jq \
    python3 \
    build-essential \
    ca-certificates \
    netcat-openbsd

# Install nvm, node and npm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash \
    && . "$NVM_DIR/nvm.sh" \
    && nvm install ${NODE_VERSION} \
    && nvm use ${NODE_VERSION} \
    && nvm alias default ${NODE_VERSION}

# Add node and npm to path
ENV PATH="${NVM_DIR}/versions/node/v${NODE_VERSION}/bin:${PATH}"
RUN npm i -g yarn
RUN curl -fsSL "https://install.aztec.network/${AZTEC_VERSION}" \
    | VERSION="${AZTEC_VERSION}" bash -s
