# Aztec Starter

This repo is meant to be a starting point for writing Aztec contracts and tests.

You can find the Easy Private Voting contract in `./src/main.nr`. A simple integration test is in `./src/test/index.test.ts`.

The corresponding tutorial can be found in the [Aztec docs here](https://docs.aztec.network/tutorials/codealong/contract_tutorials/private_voting_contract).

## Getting Started

Use node version 18.

[Start your codespace from the codespace dropdown](https://docs.github.com/en/codespaces/getting-started/quickstart).

Get the sandbox, aztec-cli and other tooling with this command:

```bash
bash -i <(curl -s https://install.aztec.network)
```

Modify the toolkit version to match the version (`x.x.x`) specified in Nargo.toml with:

```
aztec-up x.x.x
```

or update to the latest version with:

```bash
aztec-up
```

Start the sandbox with:

```bash
aztec start --sandbox
```

## Install packages

```bash
yarn install
```

## Compile

```bash
aztec-nargo compile
```

or

```bash
yarn compile
```

## Codegen

Generate the contract artifact json and typescript interface

```bash
yarn codegen
```

## Test

Make sure the sandbox is running before running tests.

```bash
aztec start --sandbox
```

Then test with:

```bash
yarn test
```

Testing will run the Typescript tests defined in `index.test.ts` file in the `./src/test` directory, as well as the [Aztec Testing eXecution Environment (TXE)](https://docs.aztec.network/guides/developer_guides/smart_contracts/testing_contracts/testing) tests defined in [`first.nr`](./src/test/first.nr) (and imported at the top of the contract file with `mod test;`).

## Error resolution

### Update Nodejs and Noir dependencies

```bash
yarn update
```

### Update Contract

Get the contract code from the monorepo. The script will look at the versions defined in `./Nargo.toml` and fetch that version of the code from the monorepo.

```bash
yarn update
```

You may need to update permissions with:

```bash
chmod +x update_contract.sh
```
