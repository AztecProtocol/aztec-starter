<div align="center">
  <a href="https://aztec.network">
    <img src="https://github.com/AztecProtocol/aztec-packages/blob/master/docs/static/img/aztec-logo.9cde8ae1.svg" alt="Aztec Protocol Logo" width="300">
  </a>
</div>

# Aztec Starter

## Sandbox

This repo is meant to be a starting point for writing Aztec contracts and tests on the Aztec sandbox (local development environment).

You can find the **Easy Private Voting contract** in `./src/main.nr`. A simple integration test is in `./src/test/index.test.ts`.

The corresponding tutorial can be found in the [Aztec docs here](https://docs.aztec.network/developers/tutorials/codealong/contract_tutorials/private_voting_contract).

## Testnet

If you are interested in trying out this repo with the testnet, try the [testnet branch](https://github.com/AztecProtocol/aztec-starter/tree/testnet). The testnet branch is more suitable for simple interactions with the testnet via script, or as a reference to see how to do something against a live, remote network. The `main` branch should be used for getting started with writing contracts and rapid, local testing.

<div align="center">

[![GitHub Repo stars](https://img.shields.io/github/stars/AztecProtocol/aztec-starter?logo=github&color=yellow)](https://github.com/AztecProtocol/aztec-starter/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/AztecProtocol/aztec-starter?logo=github&color=blue)](https://github.com/AztecProtocol/aztec-starter/network/members)
[![Build](https://github.com/AztecProtocol/aztec-starter/actions/workflows/update.yaml/badge.svg)](https://github.com/AztecProtocol/aztec-starter/actions)
[![GitHub last commit](https://img.shields.io/github/last-commit/AztecProtocol/aztec-starter?logo=git)](https://github.com/AztecProtocol/aztec-starter/commits/main)
[![License](https://img.shields.io/github/license/AztecProtocol/aztec-starter)](https://github.com/AztecProtocol/aztec-starter/blob/main/LICENSE)
[![Discord](https://img.shields.io/badge/discord-join%20chat-5B5EA6)](https://discord.gg/aztec)
[![Twitter Follow](https://img.shields.io/twitter/follow/aztecnetwork?style=flat&logo=twitter)](https://x.com/aztecnetwork)

</div>

---

# Aztec Testnet Setup Guide

This repository provides a script to automate the setup and interaction with the Aztec testnet using a single command in a Docker container.

## Prerequisites
- Docker installed on your machine.

## Usage
1. Clone the repository:
   ```bash
   git clone https://github.com/Gmhax/aztec-starter.git
   cd aztec-starter
  - Build the Docker image
  ```bash
  docker build -t aztec-testnet .
  ```
  - Run the Docker container:
  ```bash
  docker run --rm aztec-testnet
  ```

 - Follow the output to see the setup process, including account creation, contract deployment, token minting, and balance checking.

## Expected Output
- Private balance: 8n
- Public balance: 2n

## Notes
- The script uses Aztec testnet version 0.85.0-alpha-testnet.5.
- If you encounter a Timeout awaiting isMined message, the transaction is still processing and you can proceed.
- For further exploration, refer to the Aztec documentation.




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
