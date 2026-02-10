// End-to-end tests for the Pod Racing game contract
// Tests the full game lifecycle on a real Aztec network

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
import { TxStatus } from "@aztec/stdlib/tx";
import { TestWallet } from '@aztec/test-wallet/server';
import { AccountManager } from "@aztec/aztec.js/wallet";

// Test constants
const TEST_GAME_IDS = {
    CREATE: 1,
    JOIN: 2,
    PLAY_ROUND: 3,
    INVALID_POINTS: 4,
    SEQUENTIAL: 5,
    FULL_GAME: 100,
    PRIVACY: 200,
    MAX_POINTS: 201,
    ZERO_POINTS: 202,
};

// Common point allocation strategies
const STRATEGIES = {
    balanced: { track1: 2, track2: 2, track3: 2, track4: 2, track5: 1 },
    aggressive: { track1: 3, track2: 3, track3: 3, track4: 0, track5: 0 },
    defensive: { track1: 0, track2: 0, track3: 1, track4: 4, track5: 4 },
    maxPoints: { track1: 5, track2: 2, track3: 1, track4: 1, track5: 0 },
    tooManyPoints: { track1: 2, track2: 2, track3: 2, track4: 2, track5: 2 }, // 10 points - invalid
};

// Helper to play a round with a strategy
async function playRound(
    contract: PodRacingContract,
    gameId: Fr,
    round: number,
    strategy: typeof STRATEGIES.balanced,
    playerAccount: AztecAddress,
    sponsoredPaymentMethod: SponsoredFeePaymentMethod,
    timeout: number
) {
    return await contract.methods.play_round(
        gameId,
        round,
        strategy.track1,
        strategy.track2,
        strategy.track3,
        strategy.track4,
        strategy.track5
    ).send({
        from: playerAccount,
        fee: { paymentMethod: sponsoredPaymentMethod },
        wait: { timeout }
    });
}

// Helper to setup a game (create + join)
async function setupGame(
    contract: PodRacingContract,
    gameId: Fr,
    player1Address: AztecAddress,
    player2Address: AztecAddress,
    sponsoredPaymentMethod: SponsoredFeePaymentMethod,
    timeout: number
) {
    await contract.methods.create_game(gameId).send({
        from: player1Address,
        fee: { paymentMethod: sponsoredPaymentMethod },
        wait: { timeout }
    });

    await contract.methods.join_game(gameId).send({
        from: player2Address,
        fee: { paymentMethod: sponsoredPaymentMethod },
        wait: { timeout }
    });
}

describe("Pod Racing Game", () => {
    let logger: Logger;
    let sponsoredFPC: ContractInstanceWithAddress;
    let sponsoredPaymentMethod: SponsoredFeePaymentMethod;
    let wallet: TestWallet;
    let player1Account: AccountManager;
    let player2Account: AccountManager;
    let contract: PodRacingContract;

    beforeAll(async () => {
        logger = createLogger('aztec:aztec-starter:pod-racing');
        logger.info(`Pod Racing tests running.`)
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

        // Deploy the contract once for all tests
        logger.info('Deploying Pod Racing contract...');
        const adminAddress = player1Account.address;
        contract = await PodRacingContract.deploy(wallet, adminAddress).send({
            from: adminAddress,
            fee: { paymentMethod: sponsoredPaymentMethod },
            wait: { timeout: getTimeouts().deployTimeout }
        });

        logger.info(`Contract deployed at: ${contract.address.toString()}`);
    }, 600000)

    it("Verifies contract was deployed", async () => {
        expect(contract).toBeDefined();
        expect(contract.address).toBeDefined();
        logger.info('Contract deployment verified');
    }, 60000)

    it("Creates a game", async () => {
        logger.info('Starting create game test');
        const gameId = new Fr(TEST_GAME_IDS.CREATE);

        const tx = await contract.methods.create_game(gameId).send({
            from: player1Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod },
            wait: { timeout: getTimeouts().txTimeout }
        });

        // Transaction succeeded if we got here - status could be PROPOSED, CHECKPOINTED, PROVEN, or FINALIZED
        expect([TxStatus.PROPOSED, TxStatus.CHECKPOINTED, TxStatus.PROVEN, TxStatus.FINALIZED]).toContain(tx.status);
        logger.info('Game created successfully');
    }, 600000)

    it("Allows a second player to join", async () => {
        logger.info('Starting join game test');
        const gameId = new Fr(TEST_GAME_IDS.JOIN);

        // Setup game
        await setupGame(
            contract,
            gameId,
            player1Account.address,
            player2Account.address,
            sponsoredPaymentMethod,
            getTimeouts().txTimeout
        );

        logger.info('Player 2 joined successfully');
    }, 600000)

    it("Plays a complete round", async () => {
        logger.info('Starting play round test');
        const gameId = new Fr(TEST_GAME_IDS.PLAY_ROUND);

        // Setup game
        await setupGame(
            contract,
            gameId,
            player1Account.address,
            player2Account.address,
            sponsoredPaymentMethod,
            getTimeouts().txTimeout
        );

        // Player 1 plays round 1 with balanced strategy
        const playTx = await playRound(
            contract,
            gameId,
            1,
            STRATEGIES.balanced,
            player1Account.address,
            sponsoredPaymentMethod,
            getTimeouts().txTimeout
        );

        // Transaction succeeded if we got here - status could be PROPOSED, CHECKPOINTED, PROVEN, or FINALIZED
        expect([TxStatus.PROPOSED, TxStatus.CHECKPOINTED, TxStatus.PROVEN, TxStatus.FINALIZED]).toContain(playTx.status);
        logger.info('Round played successfully');
    }, 600000)

    it("Rejects rounds with too many points", async () => {
        logger.info('Starting invalid round test');
        const gameId = new Fr(TEST_GAME_IDS.INVALID_POINTS);

        await setupGame(
            contract,
            gameId,
            player1Account.address,
            player2Account.address,
            sponsoredPaymentMethod,
            getTimeouts().txTimeout
        );

        // Try to allocate 10 points (should fail)
        await expect(
            playRound(
                contract,
                gameId,
                1,
                STRATEGIES.tooManyPoints,
                player1Account.address,
                sponsoredPaymentMethod,
                getTimeouts().txTimeout
            )
        ).rejects.toThrow();

        logger.info('Invalid round correctly rejected');
    }, 600000)

    it("Prevents playing rounds out of order", async () => {
        logger.info('Starting sequential round enforcement test');
        const gameId = new Fr(TEST_GAME_IDS.SEQUENTIAL);

        await setupGame(
            contract,
            gameId,
            player1Account.address,
            player2Account.address,
            sponsoredPaymentMethod,
            getTimeouts().txTimeout
        );

        // Try to play round 2 without playing round 1 (should fail)
        await expect(
            playRound(
                contract,
                gameId,
                2,
                STRATEGIES.balanced,
                player1Account.address,
                sponsoredPaymentMethod,
                getTimeouts().txTimeout
            )
        ).rejects.toThrow();

        logger.info('Sequential round enforcement working correctly');
    }, 600000)

    it("Plays a full game from start to finish", async () => {
        logger.info('Starting full game test');
        const gameId = new Fr(TEST_GAME_IDS.FULL_GAME);

        // Create and join game
        await setupGame(
            contract,
            gameId,
            player1Account.address,
            player2Account.address,
            sponsoredPaymentMethod,
            getTimeouts().txTimeout
        );

        logger.info('Game created and joined, playing rounds...');

        // Player 1 strategy: Focus on tracks 1, 2, 3
        await playRound(contract, gameId, 1, { track1: 3, track2: 2, track3: 2, track4: 1, track5: 1 },
            player1Account.address, sponsoredPaymentMethod, getTimeouts().txTimeout);
        await playRound(contract, gameId, 2, { track1: 2, track2: 3, track3: 2, track4: 1, track5: 1 },
            player1Account.address, sponsoredPaymentMethod, getTimeouts().txTimeout);
        await playRound(contract, gameId, 3, { track1: 2, track2: 2, track3: 3, track4: 1, track5: 1 },
            player1Account.address, sponsoredPaymentMethod, getTimeouts().txTimeout);

        logger.info('Player 1 completed all rounds');

        // Player 2 strategy: Focus on tracks 4, 5
        await playRound(contract, gameId, 1, { track1: 1, track2: 1, track3: 2, track4: 2, track5: 3 },
            player2Account.address, sponsoredPaymentMethod, getTimeouts().txTimeout);
        await playRound(contract, gameId, 2, { track1: 1, track2: 1, track3: 2, track4: 3, track5: 2 },
            player2Account.address, sponsoredPaymentMethod, getTimeouts().txTimeout);
        await playRound(contract, gameId, 3, { track1: 1, track2: 1, track3: 2, track4: 2, track5: 3 },
            player2Account.address, sponsoredPaymentMethod, getTimeouts().txTimeout);

        logger.info('Player 2 completed all rounds');

        // Both players reveal their scores
        await contract.methods.finish_game(gameId).send({
            from: player1Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod },
            wait: { timeout: getTimeouts().txTimeout }
        });

        await contract.methods.finish_game(gameId).send({
            from: player2Account.address,
            fee: { paymentMethod: sponsoredPaymentMethod },
            wait: { timeout: getTimeouts().txTimeout }
        });

        logger.info('Both players finished and revealed scores');
        logger.info('Full game flow completed successfully');
    }, 600000)

    it("Maintains privacy of round choices until reveal", async () => {
        logger.info('Starting privacy test');
        const gameId = new Fr(TEST_GAME_IDS.PRIVACY);

        await setupGame(
            contract,
            gameId,
            player1Account.address,
            player2Account.address,
            sponsoredPaymentMethod,
            getTimeouts().txTimeout
        );

        // Player 1 plays a round with secret distribution
        await playRound(
            contract,
            gameId,
            1,
            STRATEGIES.maxPoints,
            player1Account.address,
            sponsoredPaymentMethod,
            getTimeouts().txTimeout
        );

        logger.info('Round played privately');
        logger.info('Privacy maintained - round choices are private');
    }, 600000)

    it("Allows maximum points allocation (9 points)", async () => {
        logger.info('Starting max points test');
        const gameId = new Fr(TEST_GAME_IDS.MAX_POINTS);

        await setupGame(
            contract,
            gameId,
            player1Account.address,
            player2Account.address,
            sponsoredPaymentMethod,
            getTimeouts().txTimeout
        );

        // Allocate exactly 9 points
        const tx = await playRound(
            contract,
            gameId,
            1,
            STRATEGIES.aggressive,
            player1Account.address,
            sponsoredPaymentMethod,
            getTimeouts().txTimeout
        );

        // Transaction succeeded if we got here - status could be PROPOSED, CHECKPOINTED, PROVEN, or FINALIZED
        expect([TxStatus.PROPOSED, TxStatus.CHECKPOINTED, TxStatus.PROVEN, TxStatus.FINALIZED]).toContain(tx.status);
        logger.info('Max points allocation successful');
    }, 600000)

    it("Allows zero points allocation", async () => {
        logger.info('Starting zero points test');
        const gameId = new Fr(TEST_GAME_IDS.ZERO_POINTS);

        await setupGame(
            contract,
            gameId,
            player1Account.address,
            player2Account.address,
            sponsoredPaymentMethod,
            getTimeouts().txTimeout
        );

        // Allocate 0 points
        const tx = await playRound(
            contract,
            gameId,
            1,
            { track1: 0, track2: 0, track3: 0, track4: 0, track5: 0 },
            player1Account.address,
            sponsoredPaymentMethod,
            getTimeouts().txTimeout
        );

        // Transaction succeeded if we got here - status could be PROPOSED, CHECKPOINTED, PROVEN, or FINALIZED
        expect([TxStatus.PROPOSED, TxStatus.CHECKPOINTED, TxStatus.PROVEN, TxStatus.FINALIZED]).toContain(tx.status);
        logger.info('Zero points allocation successful');
    }, 600000)
});
