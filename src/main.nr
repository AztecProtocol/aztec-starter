mod test;
mod types;
use dep::aztec::macros::aztec;

#[aztec]
contract EasyPrivateVoting {
    use crate::types::shared_note::{SHARED_NOTE_LEN, SharedNote};
    use dep::aztec::{
        encrypted_logs::encrypted_note_emission::encode_and_encrypt_note,
        keys::getters::get_public_keys,
        macros::{functions::{initializer, internal, private, public}, storage::storage},
        oracle::random::random,
    };
    use dep::aztec::prelude::{AztecAddress, Map, PrivateSet, PublicMutable, SharedImmutable};
    use dep::value_note::value_note::ValueNote;

    #[storage]
    struct Storage<Context> {
        admin: PublicMutable<AztecAddress, Context>, // admin can end vote
        tally: Map<Field, PublicMutable<Field, Context>, Context>, // we will store candidate as key and number of votes as value
        vote_ended: PublicMutable<bool, Context>, // vote_ended is boolean
        active_at_block: SharedImmutable<u32, Context>, // when people can start voting
        set: PrivateSet<SharedNote, Context>,
    }

    #[public]
    #[initializer]
    // annotation to mark function as a constructor
    fn constructor(admin: AztecAddress) {
        storage.admin.write(admin);
        storage.vote_ended.write(false);
        storage.active_at_block.initialize(context.block_number() as u32);
    }

    #[private]
    // annotation to mark function as private and expose private context
    fn cast_vote(candidate: Field, bob: AztecAddress, charlie: AztecAddress) {
        let msg_sender_npk_m_hash = get_public_keys(context.msg_sender()).npk_m.hash();

        let secret = context.request_nsk_app(msg_sender_npk_m_hash); // get secret key of caller of function
        let nullifier = std::hash::pedersen_hash([context.msg_sender().to_field(), secret]); // derive nullifier from sender and secret
        context.push_nullifier(nullifier);
        EasyPrivateVoting::at(context.this_address()).add_to_tally_public(candidate).enqueue(
            &mut context,
        );
        //
        let mut shared_note = SharedNote::new(context.msg_sender(), bob, random());
        let owner_ovpk = get_public_keys(context.msg_sender()).ovpk_m;

        let n = storage.set.insert(&mut shared_note);

        n.emit(encode_and_encrypt_note(
            &mut context,
            owner_ovpk,
            context.msg_sender(),
            context.msg_sender(),
        ));

        n.emit(encode_and_encrypt_note(&mut context, owner_ovpk, bob, context.msg_sender()));
        n.emit(encode_and_encrypt_note(&mut context, owner_ovpk, charlie, context.msg_sender()));
    }

    #[public]
    #[internal]
    fn add_to_tally_public(candidate: Field) {
        assert(storage.vote_ended.read() == false, "Vote has ended"); // assert that vote has not ended
        let new_tally = storage.tally.at(candidate).read() + 1;
        storage.tally.at(candidate).write(new_tally);
    }

    #[public]
    fn end_vote() {
        assert(storage.admin.read().eq(context.msg_sender()), "Only admin can end votes"); // assert that caller is admin
        storage.vote_ended.write(true);
    }
    unconstrained fn get_vote(candidate: Field) -> pub Field {
        storage.tally.at(candidate).read()
    }
}
