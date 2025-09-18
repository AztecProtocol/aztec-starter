use crate::test::utils;
use dep::aztec::oracle::{execution::get_block_number, storage::storage_read};
use dep::aztec::protocol_types::storage::map::derive_storage_slot_in_map;

use crate::EasyPrivateVoting;

#[test]
unconstrained fn test_initializer() {
    let (_, voting_contract_address, admin) = utils::setup();

    let block_number = get_block_number();
    let admin_slot = EasyPrivateVoting::storage_layout().admin.slot;
    let admin_storage_value = storage_read(voting_contract_address, admin_slot, block_number);
    assert(admin_storage_value == admin, "Admin should be correctly stored");
}

#[test]
unconstrained fn test_check_vote_status() {
    let (_, voting_contract_address, _) = utils::setup();

    let vote_ended_expected: bool = false;

    let block_number = get_block_number();
    let status_slot = EasyPrivateVoting::storage_layout().vote_ended.slot;
    let vote_ended_read: bool = storage_read(voting_contract_address, status_slot, block_number);
    assert(vote_ended_expected == vote_ended_read, "Vote ended should be false");
}

#[test]
unconstrained fn test_end_vote() {
    let (env, voting_contract_address, admin) = utils::setup();

    env.call_public(admin, EasyPrivateVoting::at(voting_contract_address).end_vote());

    let vote_ended_expected = true;

    let block_number = get_block_number();
    let status_slot = EasyPrivateVoting::storage_layout().vote_ended.slot;
    let vote_ended_read: bool = storage_read(voting_contract_address, status_slot, block_number);
    assert(vote_ended_expected == vote_ended_read, "Vote ended should be true");

}

#[test(should_fail)]
unconstrained fn test_fail_end_vote_by_non_admin() {
    let (env, voting_contract_address, _) = utils::setup();
    let alice = env.create_light_account();
    env.call_public(alice, EasyPrivateVoting::at(voting_contract_address).end_vote());
}

#[test]
unconstrained fn test_cast_vote() {
    let (env, voting_contract_address, _) = utils::setup();
    let alice = env.create_light_account();
    let candidate = 1;
    env.call_private(alice, EasyPrivateVoting::at(voting_contract_address).cast_vote(candidate));

    env.mine_block();

    // Read vote count from storage
    let block_number = get_block_number();
    let tally_slot = EasyPrivateVoting::storage_layout().tally.slot;
    let candidate_tally_slot = derive_storage_slot_in_map(tally_slot, candidate);
    let vote_count: u32 = storage_read(voting_contract_address, candidate_tally_slot, block_number);

    assert(vote_count == 1, "vote tally should be incremented");
}

#[test]
unconstrained fn test_cast_vote_with_separate_accounts() {
    let (env, voting_contract_address, _) = utils::setup();
    let alice = env.create_light_account();
    let bob = env.create_light_account();

    let candidate = 101;

    env.call_private(alice, EasyPrivateVoting::at(voting_contract_address).cast_vote(candidate));
    env.mine_block();

    env.call_private(bob, EasyPrivateVoting::at(voting_contract_address).cast_vote(candidate));
    env.mine_block();
    

    // Read vote count from storage
    let block_number = get_block_number();
    let tally_slot = EasyPrivateVoting::storage_layout().tally.slot;
    let candidate_tally_slot = derive_storage_slot_in_map(tally_slot, candidate);
    let vote_count: u32 = storage_read(voting_contract_address, candidate_tally_slot, block_number);

    assert(vote_count == 2, "vote tally should be 2");
}

#[test(should_fail)]
unconstrained fn test_fail_vote_twice() {
    let (env, voting_contract_address, _) = utils::setup();
    let alice = env.create_light_account();

    let candidate = 101;

    env.call_private(alice, EasyPrivateVoting::at(voting_contract_address).cast_vote(candidate));
    env.mine_block();

    // Vote again as alice
    env.call_private(alice, EasyPrivateVoting::at(voting_contract_address).cast_vote(candidate));
}
