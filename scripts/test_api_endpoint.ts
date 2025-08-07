#!/usr/bin/env node

/**
 * Simple test script to validate the AztecScan API endpoint
 * This helps debug API connectivity and request format issues
 */

import { createLogger } from "@aztec/aztec.js";

const logger = createLogger('aztec:api-test');

async function testApiEndpoint() {
    const contractAddress = "0x2ce10597417f60b77f8dd2cdfc9138c418f317acf54754dde397a8b8a569d23a";
    const apiBaseUrl = "https://api.testnet.aztecscan.xyz/v1/temporary-api-key";
    const url = `${apiBaseUrl}/l2/contract-instances/${contractAddress}`;

    logger.info('🧪 Testing AztecScan API endpoint...');
    logger.info(`📍 URL: ${url}`);

    // Test 1: Check if the endpoint is reachable with a GET request
    try {
        logger.info('🔍 Test 1: Testing GET request to check endpoint availability...');
        const getResponse = await fetch(url, {
            method: 'GET',
            headers: {
                'accept': '*/*',
            }
        });

        logger.info(`📊 GET Response: ${getResponse.status} ${getResponse.statusText}`);
        const getBody = await getResponse.text();
        logger.info(`📊 GET Body: ${getBody.substring(0, 200)}...`);

    } catch (error) {
        logger.error(`❌ GET request failed: ${error}`);
    }

    // Test 2: Try a minimal POST request
    try {
        logger.info('\n🔍 Test 2: Testing minimal POST request...');
        const minimalPayload = {
            deployerMetadata: {
                contractIdentifier: "test",
                details: "test",
                creatorName: "test",
                creatorContact: "test@example.com",
                contractType: null
            },
            verifiedDeploymentArguments: {
                salt: "0x0000000000000000000000000000000000000000000000000000000000000001",
                deployer: "0x0000000000000000000000000000000000000000000000000000000000000001",
                publicKeysString: "",
                constructorArgs: [],
                stringifiedArtifactJson: "{\"name\":\"test\"}"
            }
        };

        const postResponse = await fetch(url, {
            method: 'POST',
            headers: {
                'accept': '*/*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(minimalPayload, null, 2)
        });

        logger.info(`📊 POST Response: ${postResponse.status} ${postResponse.statusText}`);
        const postBody = await postResponse.text();
        logger.info(`📊 POST Body: ${postBody}`);

    } catch (error) {
        logger.error(`❌ POST request failed: ${error}`);
    }

    // Test 3: Check if the contract exists on the network
    try {
        logger.info('\n🔍 Test 3: Checking if contract exists on network...');
        const contractInfoUrl = `${apiBaseUrl}/l2/contract-instances/${contractAddress}`;

        const contractResponse = await fetch(contractInfoUrl, {
            method: 'GET',
            headers: {
                'accept': '*/*',
            }
        });

        logger.info(`📊 Contract Info Response: ${contractResponse.status} ${contractResponse.statusText}`);
        if (contractResponse.ok) {
            const contractInfo = await contractResponse.json();
            logger.info(`📊 Contract exists: ${JSON.stringify(contractInfo, null, 2)}`);
        } else {
            const errorText = await contractResponse.text();
            logger.info(`📊 Contract not found or error: ${errorText}`);
        }

    } catch (error) {
        logger.error(`❌ Contract lookup failed: ${error}`);
    }

    // Test 4: Check API documentation endpoint
    try {
        logger.info('\n🔍 Test 4: Checking API documentation...');
        const docsUrl = `${apiBaseUrl.replace('/v1/temporary-api-key', '')}/docs`;

        const docsResponse = await fetch(docsUrl, {
            method: 'GET',
            headers: {
                'accept': 'text/html,application/json',
            }
        });

        logger.info(`📊 Docs Response: ${docsResponse.status} ${docsResponse.statusText}`);
        if (docsResponse.ok) {
            logger.info(`📊 API documentation available at: ${docsUrl}`);
        }

    } catch (error) {
        logger.info(`ℹ️  Could not access API docs: ${error}`);
    }

    logger.info('\n💡 Debugging suggestions:');
    logger.info('1. Check if your contract address is correct and deployed');
    logger.info('2. Verify the API endpoint URL is current');
    logger.info('3. Ensure all required fields are properly formatted');
    logger.info('4. Try the API documentation if available');
    logger.info('5. Check AztecScan status or community channels for known issues');
}

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
    testApiEndpoint().catch((error) => {
        console.error('API test failed:', error);
        process.exit(1);
    });
}

export { testApiEndpoint };
