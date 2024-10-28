use crate::test::utils;
use dep::aztec::{
    hash::compute_secret_hash,
    note::note_getter::{MAX_NOTES_PER_PAGE, view_notes},
    note::note_viewer_options::NoteViewerOptions,
    protocol_types::storage::map::derive_storage_slot_in_map,
    oracle::{execution::{get_block_number, get_contract_address}, storage::storage_read},
};
use dep::aztec::test::helpers::{cheatcodes, test_environment::TestEnvironment};
use crate::EasyPrivateVoting;

#[test]
unconstrained fn test_initializer() {
    let (_, voting_contract_address, admin) = utils::setup();
    check_storage_value(voting_contract_address, EasyPrivateVoting::storage_layout().admin.slot, admin, "Admin should match setup value");
}

#[test]
unconstrained fn test_check_vote_status() {
    let (_, voting_contract_address, _) = utils::setup();
    check_storage_value(voting_contract_address, EasyPrivateVoting::storage_layout().vote_ended.slot, false, "Vote ended should be false at initialization");
}

#[test]
unconstrained fn test_end_vote() {
    let (env, voting_contract_address, admin) = utils::setup();
    env.impersonate(admin);

    EasyPrivateVoting::at(voting_contract_address).end_vote().call(&mut env.public());
    check_storage_value(voting_contract_address, EasyPrivateVoting::storage_layout().vote_ended.slot, true, "Vote ended should be true after end_vote call");
}

#[test(should_fail)]
unconstrained fn test_fail_end_vote_by_non_admin() {
    let (env, voting_contract_address, _) = utils::setup();
    let alice = env.create_account();

    env.impersonate(alice);
    EasyPrivateVoting::at(voting_contract_address).end_vote().call(&mut env.public());
}

#[test]
unconstrained fn test_cast_vote() {
    let (env, voting_contract_address, _) = utils::setup();
    cast_vote_and_check_tally(&env, voting_contract_address, env.create_account(), 1, 1);
}

#[test]
unconstrained fn test_cast_vote_with_separate_accounts() {
    let (env, voting_contract_address, _) = utils::setup();

    let candidate = 101;
    cast_vote_and_check_tally(&env, voting_contract_address, env.create_account(), candidate, 1);
    cast_vote_and_check_tally(&env, voting_contract_address, env.create_account(), candidate, 2);
}

#[test(should_fail)]
unconstrained fn test_fail_vote_twice() {
    let (env, voting_contract_address, _) = utils::setup();
    let alice = env.create_account();

    let candidate = 101;
    cast_vote(&env, voting_contract_address, alice, candidate);
    cast_vote(&env, voting_contract_address, alice, candidate);
}

// Helper function to check storage values
fn check_storage_value<T: PartialEq + std::fmt::Debug>(contract_address: Address, slot: Slot, expected: T, error_message: &str) {
    let block_number = get_block_number();
    let value: T = storage_read(contract_address, slot, block_number);
    assert_eq!(value, expected, "{}", error_message);
}

// Helper function for voting and tally check
fn cast_vote_and_check_tally(env: &TestEnvironment, contract_address: Address, account: Account, candidate: u32, expected_tally: u32) {
    cast_vote(env, contract_address, account, candidate);
    let tally_slot = EasyPrivateVoting::storage_layout().tally.slot;
    let candidate_tally_slot = derive_storage_slot_in_map(tally_slot, candidate);
    check_storage_value(contract_address, candidate_tally_slot, expected_tally, "Vote tally mismatch");
}

// Helper function for voting
fn cast_vote(env: &TestEnvironment, contract_address: Address, account: Account, candidate: u32) {
    env.impersonate(account);
    env.advance_block_by(1);
    EasyPrivateVoting::at(contract_address).cast_vote(candidate).call(&mut env.private());
}
