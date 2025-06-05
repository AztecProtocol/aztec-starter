# Repository guidelines for Codex agents

This repository contains TypeScript scripts and Noir contracts for the Aztec sandbox.  
Follow these guidelines when contributing:

## Setup
- Use **Node.js v22** with Yarn.
- Install dependencies with `yarn install`.
- Start the Aztec sandbox using `aztec start --sandbox` before running tests or scripts.

## Development
- Compile contracts with `yarn compile` and generate TypeScript artifacts with `yarn codegen`.
- Use four spaces for indentation in TypeScript and scripts.
- Do not commit generated artifacts (`src/artifacts`, `target`, or `store` folders).

## Testing
- Run `yarn test` and ensure it passes before committing.  This runs both the TypeScript tests and Noir tests.

## Pull Requests
- Use clear commit messages and provide a concise description in the PR body about the change.
- Mention which tests were executed.

