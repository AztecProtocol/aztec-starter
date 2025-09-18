use dep::aztec::{
    protocol_types::address::AztecAddress,
    test::helpers::test_environment::TestEnvironment,
};

use crate::EasyPrivateVoting;

pub unconstrained fn setup() -> (&mut TestEnvironment, AztecAddress, AztecAddress) {
    let mut env = TestEnvironment::new();

    let admin = env.create_contract_account();

    let initializer_call_interface = EasyPrivateVoting::interface().constructor(admin);
    let voting_contract = env.deploy("EasyPrivateVoting").with_public_initializer(
        admin,
        initializer_call_interface,
    );

    env.mine_block();
    (&mut env, voting_contract, admin)
}
