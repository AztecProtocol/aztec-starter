// Reads debug logs from PodRacing contract transactions.
//
// debug_log_format calls in both contract functions and utility functions emit
// through the PXE oracle during .simulate() and through the node during .send().
// Set LOG_LEVEL to see them in stdout:
//
//   LOG_LEVEL='info; debug:contract_log' yarn read-logs
//
// Or for maximum verbosity:
//
//   LOG_LEVEL=debug yarn read-logs

import { PodRacingContract } from "../src/artifacts/PodRacing.js";
import { createLogger } from "@aztec/foundation/log";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { Fr } from "@aztec/aztec.js/fields";
import { GrumpkinScalar } from "@aztec/foundation/curves/grumpkin";
import { setupWallet } from "../src/utils/setup_wallet.js";
import { getSponsoredFPCInstance } from "../src/utils/sponsored_fpc.js";
import { getTimeouts } from "../config/config.js";

async function main() {
    const logger = createLogger('aztec:aztec-starter:debug-logs');
    const timeouts = getTimeouts();

    // Setup
    logger.info('Setting up wallet and accounts...');
    const wallet = await setupWallet();

    const sponsoredFPC = await getSponsoredFPCInstance();
    await wallet.registerContract(sponsoredFPC, SponsoredFPCContractArtifact);
    const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    // Create two player accounts
    const p1Account = await wallet.createSchnorrAccount(Fr.random(), Fr.random(), GrumpkinScalar.random());
    await (await p1Account.getDeployMethod()).send({
        from: AztecAddress.ZERO,
        fee: { paymentMethod },
        wait: { timeout: timeouts.deployTimeout },
    });

    const p2Account = await wallet.createSchnorrAccount(Fr.random(), Fr.random(), GrumpkinScalar.random());
    await (await p2Account.getDeployMethod()).send({
        from: AztecAddress.ZERO,
        fee: { paymentMethod },
        wait: { timeout: timeouts.deployTimeout },
    });

    await wallet.registerSender(p1Account.address, 'player1');
    await wallet.registerSender(p2Account.address, 'player2');
    logger.info(`Player 1: ${p1Account.address}`);
    logger.info(`Player 2: ${p2Account.address}`);

    // Deploy contract — constructor has debug_log_format
    logger.info('\n--- Deploying PodRacing contract (constructor logs) ---');
    const deployRequest = PodRacingContract.deploy(wallet, p1Account.address);
    await deployRequest.simulate({ from: p1Account.address });
    const contract = await deployRequest.send({
        from: p1Account.address,
        fee: { paymentMethod },
        wait: { timeout: timeouts.deployTimeout },
    });
    logger.info(`Contract deployed at: ${contract.address}`);

    const gameId = Fr.random();
    const sendOpts = (from: AztecAddress) => ({
        from,
        fee: { paymentMethod },
        wait: { timeout: timeouts.txTimeout },
    });

    // create_game (public) — logs: "Creating game {0} by player {1}"
    logger.info('\n--- create_game (public function logs) ---');
    await contract.methods.create_game(gameId).simulate({ from: p1Account.address });
    await contract.methods.create_game(gameId).send(sendOpts(p1Account.address));
    logger.info('create_game complete');

    // join_game (public) — logs: "Player {0} joining game {1}"
    logger.info('\n--- join_game (public function logs) ---');
    await contract.methods.join_game(gameId).simulate({ from: p2Account.address });
    await contract.methods.join_game(gameId).send(sendOpts(p2Account.address));
    logger.info('join_game complete');

    // play_round (private -> enqueues public) — logs track allocations + validation
    const allocations = [
        [3, 2, 2, 1, 1],
        [1, 1, 3, 2, 2],
        [2, 2, 1, 2, 2],
    ];

    for (let round = 1; round <= 3; round++) {
        const [t1, t2, t3, t4, t5] = allocations[round - 1];

        logger.info(`\n--- play_round ${round} player 1 (private + public logs) ---`);
        await contract.methods.play_round(gameId, round, t1, t2, t3, t4, t5).simulate({ from: p1Account.address });
        await contract.methods.play_round(gameId, round, t1, t2, t3, t4, t5).send(sendOpts(p1Account.address));

        logger.info(`\n--- play_round ${round} player 2 (private + public logs) ---`);
        await contract.methods.play_round(gameId, round, t5, t4, t3, t2, t1).simulate({ from: p2Account.address });
        await contract.methods.play_round(gameId, round, t5, t4, t3, t2, t1).send(sendOpts(p2Account.address));
    }

    // finish_game (private -> enqueues public) — logs computed totals + reveal
    logger.info('\n--- finish_game player 1 (private + public logs) ---');
    await contract.methods.finish_game(gameId).simulate({ from: p1Account.address });
    await contract.methods.finish_game(gameId).send(sendOpts(p1Account.address));

    logger.info('\n--- finish_game player 2 (private + public logs) ---');
    await contract.methods.finish_game(gameId).simulate({ from: p2Account.address });
    await contract.methods.finish_game(gameId).send(sendOpts(p2Account.address));

    // debug_game_state (utility function) — runs client-side in PXE, not on-chain.
    // Calls Race.log_race_state which uses debug_log_format.
    // Utility function logs go through the UtilityExecutionOracle and are emitted
    // immediately through the structured logger, just like private function logs.
    logger.info('\n--- debug_game_state (utility function — runs in PXE) ---');
    await contract.methods.debug_game_state(gameId).simulate({ from: p1Account.address });
    logger.info('Utility function simulation complete');

    logger.info('\n=== Done ===');
    logger.info('Utility function debug_log_format calls (debug_game_state) run client-side in');
    logger.info('the PXE and their logs appear in stdout via the UtilityExecutionOracle.');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        const logger = createLogger('aztec:aztec-starter:debug-logs');
        logger.error(`Failed: ${error.message}`);
        logger.error(error.stack);
        process.exit(1);
    });
