# Aztec Sandbox (aztec-sandbox)

Installs and automatically runs the Aztec Sandbox development environment with test accounts pre-configured.

## Example Usage

```json
"features": {
    "ghcr.io/aztecprotocol/devcontainer-feature/aztec-sandbox:1": {}
}
```

## Options

| Options Id | Description | Type | Default Value |
|-----|-----|-----|-----|
| autoStart | Automatically start the sandbox on container creation | boolean | true |
| importTestAccounts | Import test accounts using aztec-wallet | boolean | true |

## What This Feature Does

This feature:
1. Installs the Aztec CLI globally via npm
2. Sets up the Aztec Sandbox to run automatically on container startup
3. Imports test accounts for immediate use
4. Provides convenience commands for managing the sandbox

## Commands Provided

After installation, the following commands are available:

- `aztec-install`: Manually install Aztec tools (done automatically on container start)
- `aztec-status`: Check if the sandbox is running
- `aztec-stop`: Stop the running sandbox
- `aztec start --sandbox`: Manually start the sandbox (after Aztec tools are installed)

## Sandbox Management

The sandbox runs in the background and logs output to `/workspace/.aztec/aztec-sandbox.log`.

To monitor the sandbox logs in real-time:
```bash
tail -f /workspace/.aztec/aztec-sandbox.log
```

## Test Accounts

When `importTestAccounts` is enabled (default), test accounts are automatically imported and ready to use. These accounts come pre-funded and are ideal for development and testing.

## Customization

To disable auto-start and manage the sandbox manually:
```json
"features": {
    "ghcr.io/aztecprotocol/devcontainer-feature/aztec-sandbox:1": {
        "autoStart": false
    }
}
```

## Dependencies

This feature automatically includes:
- **Docker-in-Docker** (`ghcr.io/devcontainers/features/docker-in-docker:2`): Provides Docker daemon access required by the Aztec Sandbox

## Notes

- Node.js v20+ is required (v22 will be installed automatically if needed)
- Port 8080 is used by the sandbox for the JSON-RPC endpoint
- The Aztec tools are installed using the official installation script from install.aztec.network
- Binaries are installed to `/root/.aztec/bin` and symlinked to `/usr/local/bin`
- The sandbox runs in a Docker container and logs are available at `/workspace/.aztec/aztec-sandbox.log`
