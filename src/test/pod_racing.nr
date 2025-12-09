use crate::test::{utils, helpers};
use dep::aztec::protocol_types::storage::map::derive_storage_slot_in_map;
use crate::PodRacing;

// ============================================================================
// INITIALIZATION TESTS
// ============================================================================

// Test: Contract initialization sets admin correctly
#[test]
unconstrained fn test_initializer() {
    let (mut env, contract_address, admin) = utils::setup();

    env.public_context_at(contract_address, |context| {
        let current_admin = context.storage_read(PodRacing::storage_layout().admin.slot);
        assert_eq(current_admin, admin);
    });
}

// ============================================================================
// GAME CREATION TESTS
// ============================================================================

// Test: Creating a new game initializes Race struct correctly
#[test]
unconstrained fn test_create_game() {
    let (mut env, contract_address, _) = utils::setup();
    let player1 = env.create_light_account();
    let game_id = helpers::TEST_GAME_ID_1;

    // Player 1 creates a game
    env.call_public(player1, PodRacing::at(contract_address).create_game(game_id));

    // Verify game was created with player1 set
    env.public_context_at(contract_address, |context| {
        let race_slot = derive_storage_slot_in_map(PodRacing::storage_layout().races.slot, game_id);
        // The race struct starts with player1 address as first field
        let stored_player1 = context.storage_read(race_slot);
        assert_eq(stored_player1, player1);
    });
}

// Test: Cannot create a game with duplicate game_id
#[test(should_fail)]
unconstrained fn test_fail_create_duplicate_game() {
    let (mut env, contract_address, _) = utils::setup();
    let player1 = env.create_light_account();
    let game_id = helpers::TEST_GAME_ID_1;

    // Create game once
    env.call_public(player1, PodRacing::at(contract_address).create_game(game_id));

    // Try to create the same game_id again (should fail)
    env.call_public(player1, PodRacing::at(contract_address).create_game(game_id));
}

// ============================================================================
// GAME JOINING TESTS
// ============================================================================

// Test: Second player can join an existing game
#[test]
unconstrained fn test_join_game() {
    let (mut env, contract_address, _) = utils::setup();
    let player1 = env.create_light_account();
    let player2 = env.create_light_account();
    let game_id = helpers::TEST_GAME_ID_2;

    // Player 1 creates game
    env.call_public(player1, PodRacing::at(contract_address).create_game(game_id));

    // Player 2 joins
    env.call_public(player2, PodRacing::at(contract_address).join_game(game_id));

    // Verify both players are set
    env.public_context_at(contract_address, |context| {
        let race_slot = derive_storage_slot_in_map(PodRacing::storage_layout().races.slot, game_id);
        let stored_player1 = context.storage_read(race_slot);
        // player2 is stored at offset 1 in the Race struct
        let stored_player2 = context.storage_read(race_slot + 1);
        assert_eq(stored_player1, player1);
        assert_eq(stored_player2, player2);
    });
}

// Test: Cannot join a game that doesn't exist
#[test(should_fail)]
unconstrained fn test_fail_join_nonexistent_game() {
    let (mut env, contract_address, _) = utils::setup();
    let player2 = env.create_light_account();
    let game_id = helpers::TEST_GAME_ID_2;

    // Try to join without game being created (should fail)
    env.call_public(player2, PodRacing::at(contract_address).join_game(game_id));
}

// Test: Cannot have the same player join as player1 and player2
#[test(should_fail)]
unconstrained fn test_fail_same_player_joins_twice() {
    let (mut env, contract_address, _) = utils::setup();
    let player1 = env.create_light_account();
    let game_id = helpers::TEST_GAME_ID_2;

    env.call_public(player1, PodRacing::at(contract_address).create_game(game_id));

    // Try to join own game (should fail - player2 must be different)
    env.call_public(player1, PodRacing::at(contract_address).join_game(game_id));
}

// ============================================================================
// ROUND PLAYING TESTS
// ============================================================================

// Test: Playing a round creates private notes and updates round counter
#[test]
unconstrained fn test_play_round() {
    let (mut env, contract_address, _) = utils::setup();
    let player1 = env.create_light_account();
    let player2 = env.create_light_account();
    let game_id = helpers::TEST_GAME_ID_3;

    // Setup game
    helpers::setup_two_player_game(&mut env, contract_address, player1, player2, game_id);

    // Player 1 plays round 1 with balanced allocation
    let allocation = helpers::balanced_allocation();
    helpers::play_round_with_allocation(&mut env, contract_address, player1, game_id, 1, allocation);

    // Verify player1's round counter was incremented
    env.public_context_at(contract_address, |context| {
        let race_slot = derive_storage_slot_in_map(PodRacing::storage_layout().races.slot, game_id);
        // player1_round is at offset 3 in Race struct
        let player1_round = context.storage_read(race_slot + 3);
        assert_eq(player1_round, 1);
    });
}

// Test: Cannot allocate more than 9 points in a round
#[test(should_fail)]
unconstrained fn test_fail_play_round_too_many_points() {
    let (mut env, contract_address, _) = utils::setup();
    let player1 = env.create_light_account();
    let player2 = env.create_light_account();
    let game_id = helpers::TEST_GAME_ID_4;

    helpers::setup_two_player_game(&mut env, contract_address, player1, player2, game_id);

    // Try to allocate 10 points (2+2+2+2+2) - should fail
    env.call_private(
        player1,
        PodRacing::at(contract_address).play_round(game_id, 1, 2, 2, 2, 2, 2)
    );
}

// Test: Allocating exactly 9 points is allowed
#[test]
unconstrained fn test_play_round_with_max_points() {
    let (mut env, contract_address, _) = utils::setup();
    let player1 = env.create_light_account();
    let player2 = env.create_light_account();
    let game_id = helpers::TEST_GAME_ID_4;

    helpers::setup_two_player_game(&mut env, contract_address, player1, player2, game_id);

    // Allocate exactly 9 points (3+3+3+0+0) - should succeed
    let allocation = helpers::aggressive_allocation();
    helpers::play_round_with_allocation(&mut env, contract_address, player1, game_id, 1, allocation);

    // Verify round was played
    env.public_context_at(contract_address, |context| {
        let race_slot = derive_storage_slot_in_map(PodRacing::storage_layout().races.slot, game_id);
        let player1_round = context.storage_read(race_slot + 3);
        assert_eq(player1_round, 1);
    });
}

// Test: Allocating 0 points is allowed
#[test]
unconstrained fn test_play_round_with_zero_points() {
    let (mut env, contract_address, _) = utils::setup();
    let player1 = env.create_light_account();
    let player2 = env.create_light_account();
    let game_id = helpers::TEST_GAME_ID_4;

    helpers::setup_two_player_game(&mut env, contract_address, player1, player2, game_id);

    // Allocate 0 points total - should succeed
    env.call_private(
        player1,
        PodRacing::at(contract_address).play_round(game_id, 1, 0, 0, 0, 0, 0)
    );

    // Verify round was played
    env.public_context_at(contract_address, |context| {
        let race_slot = derive_storage_slot_in_map(PodRacing::storage_layout().races.slot, game_id);
        let player1_round = context.storage_read(race_slot + 3);
        assert_eq(player1_round, 1);
    });
}

// Test: Must play rounds sequentially
#[test(should_fail)]
unconstrained fn test_fail_skip_round() {
    let (mut env, contract_address, _) = utils::setup();
    let player1 = env.create_light_account();
    let player2 = env.create_light_account();
    let game_id = helpers::TEST_GAME_ID_5;

    helpers::setup_two_player_game(&mut env, contract_address, player1, player2, game_id);

    // Try to play round 2 without playing round 1 first (should fail)
    let allocation = helpers::balanced_allocation();
    helpers::play_round_with_allocation(&mut env, contract_address, player1, game_id, 2, allocation);
}

// Test: Both players can play rounds independently
#[test]
unconstrained fn test_both_players_play_rounds() {
    let (mut env, contract_address, _) = utils::setup();
    let player1 = env.create_light_account();
    let player2 = env.create_light_account();
    let game_id = helpers::TEST_GAME_ID_5;

    helpers::setup_two_player_game(&mut env, contract_address, player1, player2, game_id);

    // Player 1 plays round 1
    helpers::play_round_with_allocation(
        &mut env, contract_address, player1, game_id, 1, helpers::aggressive_allocation()
    );

    // Player 2 plays round 1 (with different strategy)
    helpers::play_round_with_allocation(
        &mut env, contract_address, player2, game_id, 1, helpers::defensive_allocation()
    );

    // Verify both players' round counters
    env.public_context_at(contract_address, |context| {
        let race_slot = derive_storage_slot_in_map(PodRacing::storage_layout().races.slot, game_id);
        let player1_round = context.storage_read(race_slot + 3);
        let player2_round = context.storage_read(race_slot + 4);
        assert_eq(player1_round, 1);
        assert_eq(player2_round, 1);
    });
}

// ============================================================================
// FULL GAME FLOW TESTS
// ============================================================================

// Test: Full game flow - create, join, play all rounds, finish
#[test]
unconstrained fn test_full_game_flow() {
    let (mut env, contract_address, _) = utils::setup();
    let player1 = env.create_light_account();
    let player2 = env.create_light_account();
    let game_id = helpers::TEST_GAME_ID_6;

    // Create and join game
    helpers::setup_two_player_game(&mut env, contract_address, player1, player2, game_id);

    // Player 1 plays all 3 rounds - focusing on first 3 tracks
    let p1_strategy = [
        (3, 2, 2, 1, 1),  // Round 1
        (2, 3, 2, 1, 1),  // Round 2
        (2, 2, 3, 1, 1),  // Round 3
    ];
    helpers::play_all_rounds_with_strategy(&mut env, contract_address, player1, game_id, p1_strategy);

    // Player 2 plays all 3 rounds - focusing on last 2 tracks
    let p2_strategy = [
        (1, 1, 2, 2, 3),  // Round 1
        (1, 1, 2, 3, 2),  // Round 2
        (1, 1, 2, 2, 3),  // Round 3
    ];
    helpers::play_all_rounds_with_strategy(&mut env, contract_address, player2, game_id, p2_strategy);

    // Both players finish to reveal their scores
    env.call_private(player1, PodRacing::at(contract_address).finish_game(game_id));
    env.call_private(player2, PodRacing::at(contract_address).finish_game(game_id));

    // Verify the scores were stored correctly
    env.public_context_at(contract_address, |context| {
        let race_slot = derive_storage_slot_in_map(PodRacing::storage_layout().races.slot, game_id);

        // Player 1 expected totals: (7, 7, 7, 3, 3)
        let p1_track1 = context.storage_read(race_slot + 5);
        let p1_track2 = context.storage_read(race_slot + 6);
        let p1_track3 = context.storage_read(race_slot + 7);
        let p1_track4 = context.storage_read(race_slot + 8);
        let p1_track5 = context.storage_read(race_slot + 9);

        assert_eq(p1_track1, 7);
        assert_eq(p1_track2, 7);
        assert_eq(p1_track3, 7);
        assert_eq(p1_track4, 3);
        assert_eq(p1_track5, 3);

        // Player 2 expected totals: (3, 3, 6, 7, 8)
        let p2_track1 = context.storage_read(race_slot + 10);
        let p2_track2 = context.storage_read(race_slot + 11);
        let p2_track3 = context.storage_read(race_slot + 12);
        let p2_track4 = context.storage_read(race_slot + 13);
        let p2_track5 = context.storage_read(race_slot + 14);

        assert_eq(p2_track1, 3);
        assert_eq(p2_track2, 3);
        assert_eq(p2_track3, 6);
        assert_eq(p2_track4, 7);
        assert_eq(p2_track5, 8);
    });
}

// Test: All points on one track is allowed
#[test]
unconstrained fn test_all_points_on_one_track() {
    let (mut env, contract_address, _) = utils::setup();
    let player1 = env.create_light_account();
    let player2 = env.create_light_account();
    let game_id = helpers::TEST_GAME_ID_7;

    helpers::setup_two_player_game(&mut env, contract_address, player1, player2, game_id);

    // Put all 9 points on track 1
    env.call_private(
        player1,
        PodRacing::at(contract_address).play_round(game_id, 1, 9, 0, 0, 0, 0)
    );

    env.public_context_at(contract_address, |context| {
        let race_slot = derive_storage_slot_in_map(PodRacing::storage_layout().races.slot, game_id);
        let player1_round = context.storage_read(race_slot + 3);
        assert_eq(player1_round, 1);
    });
}

// Test: Verify round counting for both players works correctly after bug fix
#[test]
unconstrained fn test_player2_sequential_rounds() {
    let (mut env, contract_address, _) = utils::setup();
    let player1 = env.create_light_account();
    let player2 = env.create_light_account();
    let game_id = helpers::TEST_GAME_ID_8;

    helpers::setup_two_player_game(&mut env, contract_address, player1, player2, game_id);

    // Player 2 plays all rounds sequentially
    for i in 0..3 {
        let round = (i + 1) as u8;
        helpers::play_round_with_allocation(
            &mut env, contract_address, player2, game_id, round, helpers::balanced_allocation()
        );
    }

    // Verify player2 completed all 3 rounds
    env.public_context_at(contract_address, |context| {
        let race_slot = derive_storage_slot_in_map(PodRacing::storage_layout().races.slot, game_id);
        let player2_round = context.storage_read(race_slot + 4);
        assert_eq(player2_round, 3);
    });
}

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

// Test: Cannot double-reveal scores
#[test(should_fail)]
unconstrained fn test_fail_double_reveal() {
    let (mut env, contract_address, _) = utils::setup();
    let player1 = env.create_light_account();
    let player2 = env.create_light_account();
    let game_id = helpers::TEST_GAME_ID_7;

    helpers::setup_two_player_game(&mut env, contract_address, player1, player2, game_id);

    // Play all rounds
    let strategy = [(3, 2, 2, 1, 1), (2, 3, 2, 1, 1), (2, 2, 3, 1, 1)];
    helpers::play_all_rounds_with_strategy(&mut env, contract_address, player1, game_id, strategy);

    // Finish once
    env.call_private(player1, PodRacing::at(contract_address).finish_game(game_id));

    // Try to finish again (should fail)
    env.call_private(player1, PodRacing::at(contract_address).finish_game(game_id));
}
