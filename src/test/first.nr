use crate::test::utils;

use dep::aztec::{
    protocol_types::storage::map::derive_storage_slot_in_map,
    oracle::{
        execution::get_block_number, 
        storage::storage_read
        }
    };

use crate::EasyPrivateVoting;

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

#[test]
unconstrained fn test_cast_vote_with_delegation() {
    let (env, voting_contract_address, _) = utils::setup();
    let alice = env.create_account();
    let bob = env.create_account();

    let candidate = 101;
    let random = 420;
    
    env.impersonate(alice);
    env.advance_block_by(1);
    EasyPrivateVoting::at(voting_contract_address).delegate_vote(bob, random).call(&mut env.private());

    env.impersonate(bob);
    env.advance_block_by(1);
    EasyPrivateVoting::at(voting_contract_address).cast_delegated_vote(candidate).call(&mut env.private());

    // Read vote count from storage
    let block_number = get_block_number();
    let tally_slot = EasyPrivateVoting::storage_layout().tally.slot;
    let candidate_tally_slot = derive_storage_slot_in_map(tally_slot, candidate);
    let vote_count: u32 = storage_read(voting_contract_address, candidate_tally_slot, block_number);

    assert(vote_count == 1, "vote tally should be 1");
}

#[test]
unconstrained fn test_cast_vote_with_multiple_delegations() {
    let (env, voting_contract_address, _) = utils::setup();
    let alice = env.create_account();
    let bob = env.create_account();
    let carl = env.create_account();
    let dave = env.create_account();
    let delegatee = env.create_account();

    let candidate = 101;
    let random = 420;
    
    env.impersonate(alice);
    env.advance_block_by(1);
    EasyPrivateVoting::at(voting_contract_address).delegate_vote(delegatee, random).call(&mut env.private());

    env.impersonate(bob);
    env.advance_block_by(1);
    EasyPrivateVoting::at(voting_contract_address).delegate_vote(delegatee, random).call(&mut env.private());

    env.impersonate(carl);
    env.advance_block_by(1);
    EasyPrivateVoting::at(voting_contract_address).delegate_vote(delegatee, random).call(&mut env.private());

    // NOTE: the limit of delegations per `cast_delegated_vote` is set to 3
    env.impersonate(dave);
    env.advance_block_by(1);
    EasyPrivateVoting::at(voting_contract_address).delegate_vote(delegatee, random).call(&mut env.private());

    env.impersonate(delegatee);
    env.advance_block_by(1);
    EasyPrivateVoting::at(voting_contract_address).cast_delegated_vote(candidate).call(&mut env.private());

    // Read vote count from storage
    let mut block_number = get_block_number();
    let tally_slot = EasyPrivateVoting::storage_layout().tally.slot;
    let candidate_tally_slot = derive_storage_slot_in_map(tally_slot, candidate);
    let mut vote_count: u32 = storage_read(voting_contract_address, candidate_tally_slot, block_number);

    assert(vote_count == 3, "vote tally should be 3");

    env.impersonate(delegatee);
    env.advance_block_by(1);
    EasyPrivateVoting::at(voting_contract_address).cast_delegated_vote(candidate).call(&mut env.private());

    block_number = get_block_number();
    vote_count = storage_read(voting_contract_address, candidate_tally_slot, block_number);

    assert(vote_count == 4, "vote tally should be 4");
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

#[test(should_fail)]
unconstrained fn test_fail_delegate_and_vote() {
    let (env, voting_contract_address, _) = utils::setup();
    let alice = env.create_account();
    let bob = env.create_account();

    let candidate = 101;
    let random = 420;
    
    env.impersonate(alice);
    env.advance_block_by(1);
    EasyPrivateVoting::at(voting_contract_address).delegate_vote(bob, random).call(&mut env.private());

    // Vote again as alice
    env.advance_block_by(1);
    EasyPrivateVoting::at(voting_contract_address).cast_vote(candidate).call(&mut env.private());
}

#[test(should_fail)]
unconstrained fn test_fail_vote_and_delegate() {
    let (env, voting_contract_address, _) = utils::setup();
    let alice = env.create_account();
    let bob = env.create_account();

    let candidate = 101;
    let random = 420;
    
    env.impersonate(alice);
    env.advance_block_by(1);
    EasyPrivateVoting::at(voting_contract_address).cast_vote(candidate).call(&mut env.private());

    // Delegate vote as alice
    env.advance_block_by(1);
    EasyPrivateVoting::at(voting_contract_address).delegate_vote(bob, random).call(&mut env.private());
}
