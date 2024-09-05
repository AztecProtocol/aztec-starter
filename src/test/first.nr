use crate::test::utils;

use dep::aztec::test::{helpers::{cheatcodes, test_environment::TestEnvironment}};
use dep::aztec::protocol_types::storage::map::derive_storage_slot_in_map;
use dep::aztec::note::note_getter::{MAX_NOTES_PER_PAGE, view_notes};
use dep::aztec::note::note_viewer_options::NoteViewerOptions;
use dep::aztec::hash::compute_secret_hash;

use dep::aztec::{oracle::{execution::{get_block_number, get_contract_address}, unsafe_rand::unsafe_rand, storage::storage_read}};

use crate::EasyPrivateVoting;

#[test]
unconstrained fn test_initializer() -> Field {
    let (env, voting_contract_address, admin, _) = utils::setup();

    std::println("======== Initializer =========");

    let alice = env.create_account();
    let bob = env.create_account();

    std::println("hello world");
    std::println(alice);

    let s = compute_secret_hash(0x01);
    std::println(s);

    1
}

#[test]
unconstrained fn check_vote_status() {
    let (env, voting_contract_address, admin, _) = utils::setup();

    let vote_ended_expected: bool = false;

    env.impersonate(voting_contract_address);
    let block_number = get_block_number();
    let status_slot = EasyPrivateVoting::storage().vote_ended.slot;
    let vote_ended_read: bool = storage_read(voting_contract_address, status_slot, block_number);
    assert(vote_ended_expected == vote_ended_read, "Vote ended should be false");
}

#[test]
unconstrained fn test_end_vote() {
    let (env, voting_contract_address, admin, _) = utils::setup();
    let alice = env.create_account();
    // std::println(f"Alice: {alice}");

    env.impersonate(admin);
    let call_interface = EasyPrivateVoting::at(voting_contract_address).end_vote();
    env.call_public(call_interface);

    let vote_ended_expected = true;

    // need to impersonate the contract to correctly read the storage
    env.impersonate(voting_contract_address);
    let block_number = get_block_number();
    let status_slot = EasyPrivateVoting::storage().vote_ended.slot;
    let vote_ended_read: bool = storage_read(voting_contract_address, status_slot, block_number);
    assert(vote_ended_expected == vote_ended_read, "Vote ended should be true");
}

// this test is currently failing. I am debugging
#[test]
unconstrained fn test_cast_vote() {
    let (env, voting_contract_address, admin, _) = utils::setup();
    let alice = env.create_account();
    env.impersonate(alice);

    let candidate = 1;
    env.advance_block_by(6);
    let call_interface = EasyPrivateVoting::at(voting_contract_address).cast_vote(candidate);
    env.call_private_void(call_interface);
}

#[test(should_fail)]
unconstrained fn test_end_vote_fail() {
    let (env, voting_contract_address, admin, _) = utils::setup();
    let alice = env.create_account();

    let call_interface = EasyPrivateVoting::at(voting_contract_address).end_vote();
    env.call_public(call_interface);
}
