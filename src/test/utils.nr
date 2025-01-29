use dep::aztec::{
    prelude::AztecAddress,
    test::helpers::{cheatcodes, test_environment::TestEnvironment},
    oracle::execution::get_contract_address,
};

use crate::EasyPrivateVoting;
use dep::token::Token;

pub unconstrained fn setup() -> (&mut TestEnvironment, AztecAddress, AztecAddress, AztecAddress) {
    let mut env = TestEnvironment::new();

    let admin = env.create_account();

    let initializer_call_interface = EasyPrivateVoting::interface().constructor(admin);
    let voting_contract = env.deploy_self("EasyPrivateVoting").with_public_void_initializer(
        initializer_call_interface,
    );

    let token_initializer_call_interface = Token::interface().constructor(
        admin,
        "NAME___________________________", // NOTE: expects str<31>
        "SYMBOL_________________________",
        18 as u8,
    );

    let token_contract = env.deploy("./@token_contract", "Token").with_public_void_initializer(
        token_initializer_call_interface,
    );

    // std::println(voting_contract);
    (&mut env, voting_contract.to_address(), admin, token_contract.to_address())
}

pub unconstrained fn get_private_balance(
    token_contract_address: AztecAddress,
    address: AztecAddress,
) -> U128 {
    let current_contract_address = get_contract_address();
    cheatcodes::set_contract_address(token_contract_address);
    // Direct call to unconstrained
    let amt = Token::balance_of_private(address);
    cheatcodes::set_contract_address(current_contract_address);
    amt
}
