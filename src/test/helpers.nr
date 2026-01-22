use dep::aztec::{
    protocol_types::address::AztecAddress, test::helpers::test_environment::TestEnvironment,
};
use crate::PodRacing;

// Test constants
pub global TEST_GAME_ID_1: Field = 1;
pub global TEST_GAME_ID_2: Field = 2;
pub global TEST_GAME_ID_3: Field = 3;
pub global TEST_GAME_ID_4: Field = 4;
pub global TEST_GAME_ID_5: Field = 5;
pub global TEST_GAME_ID_6: Field = 6;
pub global TEST_GAME_ID_7: Field = 7;
pub global TEST_GAME_ID_8: Field = 8;
pub global TEST_GAME_ID_9: Field = 9;
pub global TEST_GAME_ID_10: Field = 10;
pub global TEST_GAME_ID_11: Field = 11;
pub global TEST_GAME_ID_12: Field = 12;
pub global TEST_GAME_ID_13: Field = 13;

// Common point allocations for testing
// Balanced strategy: distribute points evenly
pub unconstrained fn balanced_allocation() -> (u8, u8, u8, u8, u8) {
    (2, 2, 2, 2, 1)
}

// Aggressive strategy: focus on first 3 tracks
pub unconstrained fn aggressive_allocation() -> (u8, u8, u8, u8, u8) {
    (3, 3, 3, 0, 0)
}

// Defensive strategy: focus on last 2 tracks
pub unconstrained fn defensive_allocation() -> (u8, u8, u8, u8, u8) {
    (0, 0, 1, 4, 4)
}

// Maximum allowed points
pub unconstrained fn max_allocation() -> (u8, u8, u8, u8, u8) {
    (5, 2, 1, 1, 0)
}

// Helper to setup a game with two players
pub unconstrained fn setup_two_player_game(
    env: &mut TestEnvironment,
    contract_address: AztecAddress,
    player1: AztecAddress,
    player2: AztecAddress,
    game_id: Field
) {
    env.call_public(player1, PodRacing::at(contract_address).create_game(game_id));
    env.call_public(player2, PodRacing::at(contract_address).join_game(game_id));
}

// Helper to play a round with specific allocations
pub unconstrained fn play_round_with_allocation(
    env: &mut TestEnvironment,
    contract_address: AztecAddress,
    player: AztecAddress,
    game_id: Field,
    round: u8,
    allocation: (u8, u8, u8, u8, u8)
) {
    let (t1, t2, t3, t4, t5) = allocation;
    env.call_private(
        player,
        PodRacing::at(contract_address).play_round(game_id, round, t1, t2, t3, t4, t5)
    );
}

// Helper to play all 3 rounds with the same strategy
pub unconstrained fn play_all_rounds_with_strategy(
    env: &mut TestEnvironment,
    contract_address: AztecAddress,
    player: AztecAddress,
    game_id: Field,
    allocations: [(u8, u8, u8, u8, u8); 3]
) {
    for i in 0..3 {
        let round = (i + 1) as u8;
        play_round_with_allocation(env, contract_address, player, game_id, round, allocations[i]);
    }
}
