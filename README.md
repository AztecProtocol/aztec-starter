<div align="center">
  <a href="https://aztec.network">
    <img src="https://github.com/AztecProtocol/aztec-packages/blob/master/docs/static/img/aztec-logo.9cde8ae1.svg" alt="Aztec Protocol Logo" width="300">
  </a>
</div>

# Aztec Starter

## Sandbox

This repo is meant to be a starting point for writing Aztec contracts and tests on the Aztec sandbox (local development environment).

You can find the **Easy Private Voting contract** in `./src/main.nr`. A simple integration test is in `./src/test/e2e/index.test.ts`.

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

## 🚀 **Getting Started**

Use **Node.js version 22.15.0**.

[Start your codespace from the codespace dropdown](https://docs.github.com/en/codespaces/getting-started/quickstart).

Get the **sandbox, aztec-cli, and other tooling** with this command:

```bash
bash -i <(curl -s https://install.aztec.network)
```

Install the correct version of the toolkit with:

```bash
aztec-up 0.87.6
```

Start the sandbox with:

```bash
aztec start --sandbox
```

---

## 📦 **Install Packages**


```bash
yarn install
```

---

## 🏗 **Compile**

```bash
aztec-nargo compile
```

or

```bash
yarn compile
```

---

## 🔧 **Codegen**

Generate the **contract artifact JSON** and TypeScript interface:

```bash
yarn codegen
```

---

:warning: Tests and scripts set up and run the Private Execution Environment (PXE) and store PXE data in the `./store` directory. If you restart the sandbox, you will need to delete the `./store` directory to avoid errors.

## Transaction Profiling

**Make sure the sandbox is running before profiling.**

```bash
aztec start --sandbox
```

Then run an example contract deployment profile with:

```bash
yarn profile
```

## 🧪 **Test**

**Make sure the sandbox is running before running tests.**

```bash
aztec start --sandbox
```

Then test with:

```bash
yarn test
```

Testing will run the **TypeScript tests** defined in `index.test.ts` inside `./src/test/e2e`, as well as the [Aztec Testing eXecution Environment (TXE)](https://docs.aztec.network/developers/guides/smart_contracts/testing) tests defined in [`first.nr`](./src/test/first.nr) (imported in the contract file with `mod test;`).

Note: The Typescript tests spawn an instance of the sandbox to test against, and close it once the TS tests are complete.

---

## Scripts

You can find a handful of scripts in the `./scripts` folder.

- `./scripts/deploy_account.ts` is an example of how to deploy a schnorr account.
- `./scripts/deploy_contract.ts` is an example of how to deploy a contract.
- `./scripts/fees.ts` is an example of how to pay for a contract deployment using various fee payment methods.
- `./scripts/multiple_pxe.ts` is an example of how to deploy a contract from one PXE instance and interact with it from another.
- `./scripts/profile_deploy.ts` shows how to profile a transaction and print the results.

## ❗ **Error Resolution**

:warning: Tests and scripts set up and run the Private Execution Environment (PXE) and store PXE data in the `./store` directory. If you restart the sandbox, you will need to delete the `./store` directory to avoid errors.

### 🔄 **Update Node.js and Noir Dependencies**

```bash
yarn update
```

### 🔄 **Update Contract**

Get the **contract code from the monorepo**. The script will look at the versions defined in `./Nargo.toml` and fetch that version of the code from the monorepo.

```bash
yarn update
```

You may need to update permissions with:

```bash
chmod +x .github/scripts/update_contract.sh
```

## Contributor Guide

This repository includes an [AGENTS.md](./AGENTS.md) file with detailed
instructions for setting up your environment, running tests, and creating
pull requests. Please read it before contributing changes.

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
