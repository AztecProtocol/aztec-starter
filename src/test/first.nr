use crate::test::utils;
use dep::aztec::test::{helpers::{cheatcodes, test_environment::TestEnvironment}};
use dep::aztec::protocol_types::storage::map::derive_storage_slot_in_map;
use dep::aztec::note::note_getter::{MAX_NOTES_PER_PAGE, view_notes};
use dep::aztec::note::note_viewer_options::NoteViewerOptions;
use dep::aztec::hash::compute_secret_hash;
use dep::aztec::{oracle::{execution::{get_block_number, get_contract_address}, storage::storage_read}};
use crate::EasyPrivateVoting;

fn read_storage_value<T: Copy>(contract_address: &str, slot: usize) -> T {
    let block_number = get_block_number();
    storage_read(contract_address, slot, block_number)
}

#[test]
unconstrained fn test_initializer() {
    let (_, voting_contract_address, admin) = utils::setup();
    let admin_slot = EasyPrivateVoting::storage_layout().admin.slot;
    let admin_storage_value: Address = read_storage_value(voting_contract_address, admin_slot);
    
    assert_eq!(admin_storage_value, admin, "Admin storage value should match");
}

#[test]
unconstrained fn test_check_vote_status() {
    let (_, voting_contract_address, _) = utils::setup();
    let expected_vote_status = false;
    let status_slot = EasyPrivateVoting::storage_layout().vote_ended.slot;
    let actual_vote_status: bool = read_storage_value(voting_contract_address, status_slot);
    
    assert_eq!(actual_vote_status, expected_vote_status, "Vote ended should be false");
}

#[test]
unconstrained fn test_end_vote() {
    let (env, voting_contract_address, admin) = utils::setup();
    env.impersonate(admin);
    
    let call_interface = EasyPrivateVoting::at(voting_contract_address).end_vote();
    env.call_public(call_interface);
    
    let expected_vote_status = true;
    let status_slot = EasyPrivateVoting::storage_layout().vote_ended.slot;
    let actual_vote_status: bool = read_storage_value(voting_contract_address, status_slot);
    
    assert_eq!(actual_vote_status, expected_vote_status, "Vote ended should be true");
}

#[test(should_fail)]
unconstrained fn test_fail_end_vote_by_non_admin() {
    let (env, voting_contract_address, _) = utils::setup();
    let alice = env.create_account();
    env.impersonate(alice);
    
    let call_interface = EasyPrivateVoting::at(voting_contract_address).end_vote();
    env.call_public(call_interface);
}

#[test]
unconstrained fn test_cast_vote() {
    let (env, voting_contract_address, _) = utils::setup();
    let alice = env.create_account();
    env.impersonate(alice);
    
    let candidate = 1;
    env.advance_block_by(6);
    let call_interface = EasyPrivateVoting::at(voting_contract_address).cast_vote(candidate);
    env.call_private_void(call_interface);
    
    // Read vote count from storage
    let tally_slot = EasyPrivateVoting::storage_layout().tally.slot;
    let candidate_tally_slot = derive_storage_slot_in_map(tally_slot, candidate);
    let vote_count: u32 = read_storage_value(voting_contract_address, candidate_tally_slot);
    
    assert_eq!(vote_count, 1, "Vote tally should be incremented");
}

#[test]
unconstrained fn test_cast_vote_with_separate_accounts() {
    let (env, voting_contract_address, _) = utils::setup();
    let alice = env.create_account();
    let bob = env.create_account();
    
    let candidate = 101;
    
    // Alice votes
    env.impersonate(alice);
    env.advance_block_by(1);
    let call_interface = EasyPrivateVoting::at(voting_contract_address).cast_vote(candidate);
    env.call_private_void(call_interface);
    
    // Bob votes
    env.impersonate(bob);
    env.advance_block_by(1);
    let call_interface = EasyPrivateVoting::at(voting_contract_address).cast_vote(candidate);
    env.call_private_void(call_interface);
    
    // Read vote count from storage
    let tally_slot = EasyPrivateVoting::storage_layout().tally.slot;
    let candidate_tally_slot = derive_storage_slot_in_map(tally_slot, candidate);
    let vote_count: u32 = read_storage_value(voting_contract_address, candidate_tally_slot);
    
    assert_eq!(vote_count, 2, "Vote tally should be 2");
}

#[test(should_fail)]
unconstrained fn test_fail_vote_twice() {
    let (env, voting_contract_address, _) = utils::setup();
    let alice = env.create_account();
    let candidate = 101;

    // Alice votes
    env.impersonate(alice);
    env.advance_block_by(1);
    let call_interface = EasyPrivateVoting::at(voting_contract_address).cast_vote(candidate);
    env.call_private_void(call_interface);

    // Vote again as Alice
    env.advance_block_by(1);
    let call_interface = EasyPrivateVoting::at(voting_contract_address).cast_vote(candidate);
    env.call_private_void(call_interface);
}

