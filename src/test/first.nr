use crate::test::utils;
use dep::aztec::oracle::{execution::get_block_number, storage::storage_read, debug_log};
use dep::aztec::protocol_types::storage::map::derive_storage_slot_in_map;

use crate::EasyPrivateVoting;
use dep::token::Token;

#[test]
unconstrained fn test_initializer() {
    let (_, voting_contract_address, admin) = utils::setup();

    let block_number = get_block_number();
    let admin_slot = EasyPrivateVoting::storage_layout().admin.slot;
    let admin_storage_value = storage_read(voting_contract_address, admin_slot, block_number);
    assert(admin_storage_value == admin, "Vote ended should be false");
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

    env.impersonate(admin);
    EasyPrivateVoting::at(voting_contract_address).end_vote().call(&mut env.public());

    let vote_ended_expected = true;

    let block_number = get_block_number();
    let status_slot = EasyPrivateVoting::storage_layout().vote_ended.slot;
    let vote_ended_read: bool = storage_read(voting_contract_address, status_slot, block_number);
    assert(vote_ended_expected == vote_ended_read, "Vote ended should be true");
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
    let alice = env.create_account();
    env.impersonate(alice);

    let candidate = 1;
    env.advance_block_by(6);
    EasyPrivateVoting::at(voting_contract_address).cast_vote(candidate).call(&mut env.private());

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
    let alice = env.create_account();
    let bob = env.create_account();

    let candidate = 101;

    env.impersonate(alice);
    env.advance_block_by(1);
    EasyPrivateVoting::at(voting_contract_address).cast_vote(candidate).call(&mut env.private());

    env.impersonate(bob);
    env.advance_block_by(1);
    EasyPrivateVoting::at(voting_contract_address).cast_vote(candidate).call(&mut env.private());

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
    let alice = env.create_account();

    let candidate = 101;

    env.impersonate(alice);
    env.advance_block_by(1);
    EasyPrivateVoting::at(voting_contract_address).cast_vote(candidate).call(&mut env.private());

    // Vote again as alice
    env.advance_block_by(1);
    EasyPrivateVoting::at(voting_contract_address).cast_vote(candidate).call(&mut env.private());
}

#[test]
unconstrained fn test_mint_to_private() {
    let (env, _, admin, token_contract_address) = utils::setup();

    env.impersonate(admin);
    let alice = env.create_account();

    Token::at(token_contract_address).mint_to_private(alice, alice, U128::from_integer(100)).call(&mut env.private());

    env.impersonate(alice);
    Token::at(token_contract_address).transfer(admin, U128::from_integer(1)).call(&mut env.private());
}