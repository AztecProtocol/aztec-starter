
# Aztec Testnet Setup Guide

This repository provides a script to automate the setup and interaction with the Aztec testnet using a single command in a Docker container.

## Prerequisites
- Docker installed on your machine.

## Usage
1. Clone the repository:
   ```bash
   git clone https://github.com/Gmhax/aztec-starter.git
   cd aztec-starter
   ```

  - Build the Docker image
   ```bash
   docker build -t aztec-testnet .
   ```

  - Run the Docker container:
   ```bash
   docker run -it --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  aztec-testnet
   ```

 - Follow the output to see the setup process, including account creation, contract deployment, token minting, and balance checking.

## Expected Output
- Private balance: 8n
- Public balance: 2n

## Notes
- The script uses Aztec testnet version 0.85.0-alpha-testnet.5.
- If you encounter a Timeout awaiting isMined message, the transaction is still processing and you can proceed.
- For further exploration, refer to the [Aztec documentation.](https://docs.aztec.network/developers/guides/getting_started_on_testnet)




### 💬 Join the Community:

<p align="left">
  <a href="https://forum.aztec.network">
    <img src="https://img.shields.io/badge/Aztec%20%20Forum-5C4C9F?style=for-the-badge&logo=startrek&logoColor=white" alt="Forum">
  </a>  
  <a href="https://t.me/AztecAnnouncements_Official">
    <img src="https://img.shields.io/badge/Telegram-26A5E4?logo=telegram&logoColor=white&style=for-the-badge" alt="Telegram">
  </a>
  <a href="https://discord.gg/aztec">
    <img src="https://img.shields.io/badge/Discord-5865F2?logo=discord&logoColor=white&style=for-the-badge" alt="Discord">
  </a>
  <a href="https://x.com/aztecnetwork">
    <img src="https://img.shields.io/badge/Twitter-000000?logo=x&logoColor=white&style=for-the-badge" alt="Twitter (X)">
  </a>
</p>
