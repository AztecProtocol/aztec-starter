contract EasyPrivateVoting {
    use dep::aztec::prelude::{
        AztecAddress, FunctionSelector, NoteHeader, NoteInterface, NoteGetterOptions, PrivateContext,
        Map, PublicMutable
    };
    use dep::aztec::keys::getters::get_npk_m_hash;
    #[aztec(storage)]
    struct Storage {
        admin: PublicMutable<AztecAddress>, // admin can end vote
        tally: Map<Field, PublicMutable<Field>>, // we will store candidate as key and number of votes as value
        vote_ended: PublicMutable<bool>, // vote_ended is boolean
    }
    #[aztec(public)]
    #[aztec(initializer)] // annotation to mark function as a constructor
    fn constructor(admin: AztecAddress) {
        storage.admin.write(admin);
        storage.vote_ended.write(false);
    }
    #[aztec(private)] // annotation to mark function as private and expose private context
    fn cast_vote(candidate: Field) {
        let msg_sender_npk_m_hash = get_npk_m_hash(&mut context, context.msg_sender());
        // TODO (#6312): This will break with key rotation. Fix this. Can vote multiple times by rotating keys.
        let secret = context.request_nsk_app(msg_sender_npk_m_hash); // get secret key of caller of function
        let nullifier = dep::std::hash::pedersen_hash([context.msg_sender().to_field(), secret]); // derive nullifier from sender and secret
        context.push_new_nullifier(nullifier, 0); // push nullifier
        EasyPrivateVoting::at(context.this_address()).add_to_tally_public(candidate).enqueue(&mut context);
    }

    #[aztec(public)]
    #[aztec(internal)]
    fn add_to_tally_public(candidate: Field) {
        assert(storage.vote_ended.read() == false, "Vote has ended"); // assert that vote has not ended
        let new_tally = storage.tally.at(candidate).read() + 1;
        storage.tally.at(candidate).write(new_tally);
    }

    #[aztec(public)] 
    fn end_vote() {
        assert(storage.admin.read().eq(context.msg_sender()), "Only admin can end votes"); // assert that caller is admin
        storage.vote_ended.write(true);
    }
    unconstrained fn get_vote(candidate: Field) -> pub Field {
        storage.tally.at(candidate).read()
    }
}
