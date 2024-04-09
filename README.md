# Aztec Starter

This repo is meant to be a starting point for writing Aztec contracts and tests.

You can find the Easy Private Voting contract in `./src/main.nr`. A simple integration test is in `./src/test/index.test.ts`.

The corresponding tutorial can be found in the [Aztec docs here](https://docs.aztec.network/dev_docs/tutorials/writing_private_voting_contract).

## Getting Started

[Start your codespace from the codespace dropdown](https://docs.github.com/en/codespaces/getting-started/quickstart).

Get the sandbox, aztec-cli and other tooling with this command:

```bash
bash -i <(curl -s install.aztec.network)
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
aztec-sandbox
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

## Deploy

Add `ADMIN` to your environment.

```bash
ADMIN="0x1d30d4de97657983408587c7a91ba6587774b30f0e70224a0658f0357092f495"
```

```bash
aztec-cli deploy src/artifacts/EasyPrivateVoting.json --args $ADMIN
```

## Test

```bash
yarn test
```

## Error resolution

### Update Nodejs and Noir dependencies

```bash
aztec-cli update
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
