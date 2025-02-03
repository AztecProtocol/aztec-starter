<div align="center">
  <a href="https://aztec.network">
    <img src="https://github.com/AztecProtocol/aztec-packages/blob/master/docs/static/img/aztec-logo.9cde8ae1.svg" alt="Aztec Protocol Logo" width="300">
  </a>
</div>

# Aztec Starter

This repo is meant to be a starting point for writing Aztec contracts and tests.

You can find the **Easy Private Voting contract** in `./src/main.nr`. A simple integration test is in `./src/test/index.test.ts`.

The corresponding tutorial can be found in the [Aztec docs here](https://docs.aztec.network/tutorials/codealong/contract_tutorials/private_voting_contract).

<div align="center">

[![GitHub Repo stars](https://img.shields.io/github/stars/AztecProtocol/aztec-starter?logo=github&color=yellow)](https://github.com/AztecProtocol/aztec-starter/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/AztecProtocol/aztec-starter?logo=github&color=blue)](https://github.com/AztecProtocol/aztec-starter/network/members)
[![GitHub last commit](https://img.shields.io/github/last-commit/AztecProtocol/aztec-starter?logo=git)](https://github.com/AztecProtocol/aztec-starter/commits/main)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/license/mit)
[![Discord](https://img.shields.io/discord/924442927399313448?logo=discord&color=5865F2)](https://discord.gg/aztec)
[![Twitter Follow](https://img.shields.io/twitter/follow/aztecnetwork?style=flat&logo=twitter)](https://x.com/aztecnetwork)

</div>

---

## 🚀 **Getting Started**

Use **Node.js version 18**.

[Start your codespace from the codespace dropdown](https://docs.github.com/en/codespaces/getting-started/quickstart).

Get the **sandbox, aztec-cli, and other tooling** with this command:

```bash
bash -i <(curl -s https://install.aztec.network)
```

Install the correct version of the toolkit with:

```bash
aztec-up 0.73.0
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

## 🧪 **Test**

**Make sure the sandbox is running before running tests.**

```bash
aztec start --sandbox
```

Then test with:

```bash
yarn test
```

Testing will run the **TypeScript tests** defined in `index.test.ts` inside `./src/test`, as well as the [Aztec Testing eXecution Environment (TXE)](https://docs.aztec.network/guides/developer_guides/smart_contracts/testing) tests defined in [`first.nr`](./src/test/first.nr) (imported in the contract file with `mod test;`).

---

## ❗ **Error Resolution**

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
chmod +x update_contract.sh
```

### 💬 Join the Community:

<p align="left">
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
