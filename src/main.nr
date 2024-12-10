use dep::aztec::macros::aztec;

#[aztec]
contract SimpleLogging {
    use dep::aztec::macros::{functions::{initializer, internal, private, public}, storage::storage};
    use dep::aztec::prelude::{Map, PublicMutable};
    #[storage]
    struct Storage<Context> {
        counters: Map<Field, PublicMutable<Field, Context>, Context>,
    }

    #[public]
    #[initializer]
    fn constructor() {}

    #[private]
    fn increace_counter_private(counter_id: Field) {
        //let msg_sender_npk_m_hash = get_public_keys(context.msg_sender()).npk_m.hash();
        //let secret = context.request_nsk_app(msg_sender_npk_m_hash); // get secret key of caller of function
        //let nullifier = std::hash::pedersen_hash([context.msg_sender().to_field(), secret]); // derive nullifier from sender and secret
        //context.push_nullifier(nullifier);
        SimpleLogging::at(context.this_address()).add_to_counter_public(counter_id).enqueue(
            &mut context,
        );
    }

    #[public]
    #[internal]
    fn add_to_counter_public(counter_id: Field) {
        let new_counter_value = storage.counters.at(counter_id).read() + 1;
        storage.counters.at(counter_id).write(new_counter_value);
    }

    #[public]
    fn increase_counter_public(counter_id: Field) {
        context.emit_unencrypted_log(/*message=*/ "Counter increased public");
        let _ = SimpleLogging::at(context.this_address()).add_to_counter_public(counter_id);
    }
    unconstrained fn get_counter_value(counter_id: Field) -> pub Field {
        storage.counters.at(counter_id).read()
    }
}
