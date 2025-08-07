import { createLogger, AztecAddress, Fr } from "@aztec/aztec.js";
import { readFileSync } from 'fs';
import { join } from 'path';

const logger = createLogger('aztec:contract-verifier');

/**
 * Interface for deployer metadata required by the verification API
 */
export interface DeployerMetadata {
    contractIdentifier: string;
    details: string;
    creatorName: string;
    creatorContact: string;
    appUrl?: string;
    repoUrl?: string;
    contractType?: string | null;
}

/**
 * Interface for verified deployment arguments
 */
export interface VerifiedDeploymentArguments {
    salt: string;
    deployer: string;
    publicKeysString: string;
    constructorArgs: string[];
    stringifiedArtifactJson: string;
}

/**
 * Complete verification request payload
 */
export interface VerificationRequest {
    deployerMetadata: DeployerMetadata;
    verifiedDeploymentArguments: VerifiedDeploymentArguments;
}

/**
 * Configuration options for contract verification
 */
export interface VerificationConfig {
    contractAddress: string;
    apiBaseUrl?: string;
    apiKey?: string;
    timeout?: number;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
    apiBaseUrl: 'https://api.testnet.aztecscan.xyz/v1/temporary-api-key',
    timeout: 30000, // 30 seconds
};

/**
 * Loads and stringifies a contract artifact JSON file
 * @param artifactPath - Path to the artifact JSON file
 * @returns Stringified artifact JSON
 */
export function loadArtifactJson(artifactPath: string): string {
    try {
        const artifactContent = readFileSync(artifactPath, 'utf-8');
        // Validate that it's valid JSON
        JSON.parse(artifactContent);
        return artifactContent;
    } catch (error) {
        throw new Error(`Failed to load artifact from ${artifactPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Validates a contract address format
 * @param address - Contract address to validate
 * @returns true if valid, throws error if invalid
 */
export function validateContractAddress(address: string): boolean {
    try {
        // Ensure it starts with 0x and has the correct length
        if (!address.startsWith('0x') || address.length !== 66) {
            throw new Error('Invalid address format: must be 0x followed by 64 hex characters');
        }

        // Try to create an AztecAddress to validate format
        AztecAddress.fromString(address);
        return true;
    } catch (error) {
        throw new Error(`Invalid contract address: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Validates deployment arguments
 * @param args - Deployment arguments to validate
 */
export function validateDeploymentArgs(args: VerifiedDeploymentArguments): void {
    // Validate salt format
    if (!args.salt.startsWith('0x') || args.salt.length !== 66) {
        throw new Error('Invalid salt format: must be 0x followed by 64 hex characters');
    }

    // Validate deployer address
    validateContractAddress(args.deployer);

    // Validate public keys string - warn if empty but don't fail
    if (!args.publicKeysString || args.publicKeysString.trim() === '') {
        logger.warn('⚠️  Public keys string is empty. This may be required for some contract types.');
        logger.warn('   If verification fails, try providing the public keys from your deployment.');
    }

    // Validate constructor args
    if (!Array.isArray(args.constructorArgs)) {
        throw new Error('Constructor args must be an array');
    }

    // Validate artifact JSON
    try {
        const parsed = JSON.parse(args.stringifiedArtifactJson);
        if (!parsed.functions || !parsed.name) {
            logger.warn('⚠️  Artifact JSON may be missing required fields (functions, name)');
        }
    } catch (error) {
        throw new Error(`Invalid artifact JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Creates a verification request payload
 * @param metadata - Deployer metadata
 * @param deploymentArgs - Deployment arguments
 * @returns Complete verification request
 */
export function createVerificationRequest(
    metadata: DeployerMetadata,
    deploymentArgs: VerifiedDeploymentArguments
): VerificationRequest {
    // Validate inputs
    validateDeploymentArgs(deploymentArgs);

    return {
        deployerMetadata: metadata,
        verifiedDeploymentArguments: deploymentArgs
    };
}

/**
 * Sends a verification request to the Aztec scan API
 * @param config - Verification configuration
 * @param request - Verification request payload
 * @returns API response
 */
export async function sendVerificationRequest(
    config: VerificationConfig,
    request: VerificationRequest
): Promise<any> {
    const { contractAddress, apiBaseUrl = DEFAULT_CONFIG.apiBaseUrl, timeout = DEFAULT_CONFIG.timeout } = config;

    // Validate contract address
    validateContractAddress(contractAddress);

    const url = `${apiBaseUrl}/l2/contract-instances/${contractAddress}`;

    logger.info(`🔍 Sending verification request to: ${url}`);
    logger.info(`📋 Contract: ${request.deployerMetadata.contractIdentifier}`);

    // Debug logging for request payload
    logger.info(`🔍 Request payload summary:`);
    logger.info(`  - Contract Address: ${contractAddress}`);
    logger.info(`  - Salt: ${request.verifiedDeploymentArguments.salt}`);
    logger.info(`  - Deployer: ${request.verifiedDeploymentArguments.deployer}`);
    logger.info(`  - Constructor Args: ${JSON.stringify(request.verifiedDeploymentArguments.constructorArgs)}`);
    logger.info(`  - Public Keys String Length: ${request.verifiedDeploymentArguments.publicKeysString.length}`);
    logger.info(`  - Artifact JSON Length: ${request.verifiedDeploymentArguments.stringifiedArtifactJson.length}`);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const requestBody = JSON.stringify(request, null, 2);
        logger.info(`🔍 Full request body preview (first 500 chars): ${requestBody.substring(0, 500)}...`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'accept': '*/*',
                'Content-Type': 'application/json',
                ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
            },
            body: requestBody,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        logger.info(`📊 Response status: ${response.status} ${response.statusText}`);
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => { headers[key] = value; });
        logger.info(`📊 Response headers: ${JSON.stringify(headers, null, 2)}`);

        if (!response.ok) {
            const errorText = await response.text();
            logger.error(`❌ API Error Response: ${errorText}`);
            throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        logger.info('✅ Contract verification request sent successfully');
        logger.info(`📊 Response: ${JSON.stringify(result, null, 2)}`);
        return result;

    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeout}ms`);
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`❌ Verification request failed: ${errorMessage}`);
        throw error;
    }
}

/**
 * Convenience function to verify a contract with simplified parameters
 * @param params - Simplified verification parameters
 */
export async function verifyContract(params: {
    contractAddress: string;
    artifactPath: string;
    salt: string;
    deployer: string;
    publicKeysString: string;
    constructorArgs: string[];
    metadata: DeployerMetadata;
    apiBaseUrl?: string;
    apiKey?: string;
    timeout?: number;
}): Promise<any> {
    logger.info('🚀 Starting contract verification process...');

    try {
        // Load artifact JSON
        const stringifiedArtifactJson = loadArtifactJson(params.artifactPath);

        console.log(stringifiedArtifactJson)

        // Create deployment arguments
        const deploymentArgs: VerifiedDeploymentArguments = {
            salt: params.salt,
            deployer: params.deployer,
            publicKeysString: params.publicKeysString,
            constructorArgs: params.constructorArgs,
            stringifiedArtifactJson
        };

        // Create verification request
        const request = createVerificationRequest(params.metadata, deploymentArgs);

        // Send verification request
        const config: VerificationConfig = {
            contractAddress: params.contractAddress,
            apiBaseUrl: params.apiBaseUrl,
            apiKey: params.apiKey,
            timeout: params.timeout
        };

        const result = await sendVerificationRequest(config, request);

        logger.info('🎉 Contract verification completed successfully!');
        return result;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`❌ Contract verification failed: ${errorMessage}`);
        throw error;
    }
}

/**
 * Example usage function demonstrating how to use the verification script
 */
export async function exampleUsage() {
    // Example artifact path - adjust to your actual artifact location
    const artifactPath = join(process.cwd(), 'target', 'easy_private_voting_contract-EasyPrivateVoting.json');

    const metadata: DeployerMetadata = {
        contractIdentifier: "EasyPrivateVoting",
        details: "A private voting contract deployed on Aztec testnet",
        creatorName: "Your Name",
        creatorContact: "your.email@example.com",
        appUrl: "https://your-app.com",
        repoUrl: "https://github.com/your-username/your-repo",
        contractType: null
    };

    try {
        const result = await verifyContract({
            contractAddress: "0x05b8fd49fe2979c8ae9b362471f4d75c10317ab7e8a412324cb0991e89d49d24",
            artifactPath,
            salt: "0x2Bea1Dd1439C7A5C3AfBeB6c92C7c92dE8c0f98ccE1ceEDbF5c5Fa480C5ebbFC",
            deployer: "0x6016fb6eea216feA0B40d40x6016fb6eea216feA0B40d40x6016fb6eea216feA",
            publicKeysString: "your-public-keys-string",
            constructorArgs: ["constructor-arg-1"],
            metadata,
            // Optional: customize API settings
            // apiBaseUrl: "https://api.testnet.aztecscan.xyz/v1/temporary-api-key",
            // apiKey: "your-api-key-if-needed",
            // timeout: 30000
        });

        console.log('Verification result:', result);
    } catch (error) {
        console.error('Verification failed:', error);
    }
}

// If running this script directly
if (import.meta.url === `file://${process.argv[1]}`) {
    exampleUsage().catch(console.error);
}
