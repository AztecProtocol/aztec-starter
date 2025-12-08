use dep::aztec::{
    protocol_types::address::AztecAddress, test::helpers::test_environment::TestEnvironment,
};

use crate::PodRacing;

// Setup function for pod racing contract tests
// Returns: (TestEnvironment, contract_address, admin_address)
// Note: Create player accounts in individual tests to avoid oracle errors
pub unconstrained fn setup() -> (TestEnvironment, AztecAddress, AztecAddress) {
    let mut env = TestEnvironment::new();

    let admin = env.create_light_account();

    let initializer_call_interface = PodRacing::interface().constructor(admin);
    let contract_address =
        env.deploy("PodRacing").with_public_initializer(admin, initializer_call_interface);

    (env, contract_address, admin)
}
