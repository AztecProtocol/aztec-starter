// Test to verify public function debug logging works
//
// NOTE: When using TestWallet with a remote node, simulation is forwarded to the node.
// The debug_log_format output appears in the NODE's logs, not in this test's output.
//
// To see debug logs:
// 1. Check the logs of your local Aztec node/sandbox
// 2. Look for messages like "Creating game {game_id} by player {player}"
//
// Run with: AZTEC_ENV=local-network yarn test:js --testPathPattern=public_logging

import { PodRacingContract } from "../../artifacts/PodRacing.js"
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { getSponsoredFPCInstance } from "../../utils/sponsored_fpc.js";
import { setupWallet } from "../../utils/setup_wallet.js";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { getTimeouts } from "../../../config/config.js";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { type Logger, createLogger } from "@aztec/foundation/log";
import { type ContractInstanceWithAddress } from "@aztec/aztec.js/contracts";
import { Fr } from "@aztec/aztec.js/fields";
import { GrumpkinScalar } from "@aztec/foundation/curves/grumpkin";
import { TestWallet } from '@aztec/test-wallet/server';
import { AccountManager } from "@aztec/aztec.js/wallet";

describe("Public Function Logging", () => {
    let logger: Logger;
    let sponsoredFPC: ContractInstanceWithAddress;
    let sponsoredPaymentMethod: SponsoredFeePaymentMethod;
    let wallet: TestWallet;
    let player1Account: AccountManager;
    let player2Account: AccountManager;
    let contract: PodRacingContract;

    beforeAll(async () => {
        logger = createLogger('aztec:aztec-starter:public-logging');
        logger.info(`Public logging tests running.`)
        wallet = await setupWallet();

        sponsoredFPC = await getSponsoredFPCInstance();
        await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
        sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

        // Create two player accounts
        logger.info('Creating player accounts...');
        let secretKey1 = Fr.random();
        let signingKey1 = GrumpkinScalar.random();
        let salt1 = Fr.random();
        player1Account = await wallet.createSchnorrAccount(secretKey1, salt1, signingKey1);
        await (await player1Account.getDeployMethod()).send({
            from: AztecAddress.ZERO,
            fee: { paymentMethod: sponsoredPaymentMethod },
            wait: { timeout: getTimeouts().deployTimeout }
        });

        let secretKey2 = Fr.random();
        let signingKey2 = GrumpkinScalar.random();
        let salt2 = Fr.random();
        player2Account = await wallet.createSchnorrAccount(secretKey2, salt2, signingKey2);
        await (await player2Account.getDeployMethod()).send({
            from: AztecAddress.ZERO,
            fee: { paymentMethod: sponsoredPaymentMethod },
            wait: { timeout: getTimeouts().deployTimeout }
        });

        await wallet.registerSender(player1Account.address);
        await wallet.registerSender(player2Account.address);
        logger.info('Player accounts created and registered');

        // Deploy the contract
        logger.info('Deploying Pod Racing contract...');
        const adminAddress = player1Account.address;
        contract = await PodRacingContract.deploy(wallet, adminAddress).send({
            from: adminAddress,
            fee: { paymentMethod: sponsoredPaymentMethod },
            wait: { timeout: getTimeouts().deployTimeout }
        });

        logger.info(`Contract deployed at: ${contract.address.toString()}`);
    }, 600000)

    it("Simulates create_game to see debug logs", async () => {
        const gameId = new Fr(9001);

        logger.info('=== SIMULATING create_game ===');
        logger.info('(Debug logs should appear below if LOG_LEVEL is set correctly)');

        // Simulate first to see debug logs locally
        await contract.methods.create_game(gameId).simulate({
            from: player1Account.address,
        });

        logger.info('=== SIMULATION COMPLETE ===');

        // Now actually send it
        await contract.methods.create_game(gameId).send({
            from: player1Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod },
            wait: { timeout: getTimeouts().txTimeout }
        });

        logger.info('Game created successfully');
    }, 600000)

    it("Simulates join_game to see debug logs", async () => {
        const gameId = new Fr(9002);

        // First create the game
        await contract.methods.create_game(gameId).send({
            from: player1Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod },
            wait: { timeout: getTimeouts().txTimeout }
        });

        logger.info('=== SIMULATING join_game ===');
        logger.info('(Debug logs should appear below if LOG_LEVEL is set correctly)');

        // Simulate join to see debug logs locally
        await contract.methods.join_game(gameId).simulate({
            from: player2Account.address,
        });

        logger.info('=== SIMULATION COMPLETE ===');

        // Now actually send it
        await contract.methods.join_game(gameId).send({
            from: player2Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod },
            wait: { timeout: getTimeouts().txTimeout }
        });

        logger.info('Player 2 joined successfully');
    }, 600000)

    it("Simulates multiple games to verify consistent logging", async () => {
        // Create multiple games to see the logs multiple times
        const gameIds = [new Fr(9003), new Fr(9004), new Fr(9005)];

        for (const gameId of gameIds) {
            logger.info(`=== SIMULATING create_game for game ${gameId.toString()} ===`);

            // Simulate to see debug logs
            await contract.methods.create_game(gameId).simulate({
                from: player1Account.address,
            });

            // Actually create the game
            await contract.methods.create_game(gameId).send({
                from: player1Account.address,
                fee: { paymentMethod: sponsoredPaymentMethod },
                wait: { timeout: getTimeouts().txTimeout }
            });

            logger.info(`=== SIMULATING join_game for game ${gameId.toString()} ===`);

            // Simulate join to see debug logs
            await contract.methods.join_game(gameId).simulate({
                from: player2Account.address,
            });

            // Actually join
            await contract.methods.join_game(gameId).send({
                from: player2Account.address,
                fee: { paymentMethod: sponsoredPaymentMethod },
                wait: { timeout: getTimeouts().txTimeout }
            });
        }

        logger.info('=== ALL SIMULATIONS COMPLETE ===');
        logger.info('Multiple games created and joined with logging');
    }, 600000)
});
