import * as dotenv from 'dotenv';
import * as path from 'path';

// Determine which .env file to load based on ENV variable
const env = process.env.ENV || 'sandbox';
const envFile = `.env.${env}`;

// Load environment variables from the appropriate .env file
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Also load the base .env file as fallback for any missing values
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log('Loaded environment variables from', envFile);

/**
 * Gets the node URL from environment or defaults to sandbox.
 */
export function getAztecNodeUrl(): string {
    return process.env.NODE_URL || 'http://localhost:8080';
}

export function getL1RpcUrl(): string {
    return process.env.L1_RPC_URL || 'http://localhost:8545';
}

export function getEnv(): string {
    return process.env.ENV || 'sandbox';
}

/**
 * Gets timeout values. Longer timeouts for testnet.
 */
export function getTimeouts() {
    const isTestnet = getEnv() === 'testnet';
    
    if (isTestnet) {
        return {
            deployTimeout: 1200000, // 20 minutes
            txTimeout: 180000,     // 3 minutes
            waitTimeout: 60000     // 1 minute
        };
    }
    
    return {
        deployTimeout: 120000, // 2 minutes
        txTimeout: 60000,      // 1 minute
        waitTimeout: 30000     // 30 seconds
    };
}