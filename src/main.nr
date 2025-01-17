mod test;
use dep::aztec::macros::aztec;

#[aztec]
contract EasyPrivateVoting {
    use dep::aztec::{
        context::PrivateContext,
        keys::getters::{get_nsk_app, get_public_keys},
        macros::{functions::{initializer, internal, private, public}, storage::storage, notes::note},
        note::{note_interface::NullifiableNote, utils::compute_note_hash_for_nullify},
        prelude::{AztecAddress, Map, PublicImmutable, PublicMutable, PrivateSet, NoteHeader, NoteGetterOptions},
        protocol_types::{hash::poseidon2_hash_with_separator, constants::GENERATOR_INDEX__NOTE_NULLIFIER},
        encrypted_logs::encrypted_note_emission::encode_and_encrypt_note,
        utils::comparison::Comparator,
    };


    #[storage]
    struct Storage<Context> {
        admin: PublicMutable<AztecAddress, Context>, // admin can end vote
        tally: Map<Field, PublicMutable<Field, Context>, Context>, // we will store candidate as key and number of votes as value
        vote_ended: PublicMutable<bool, Context>, // vote_ended is boolean
        active_at_block: PublicImmutable<u32, Context>, // when people can start voting
        delegations: PrivateSet<DelegateNote, Context>, // set of delegations
    }

    #[note]
    pub struct DelegateNote {
        delegator: AztecAddress,
        delegatee: AztecAddress,
        randomness: Field, // Added randomness to prevent privacy leaks
    }

    impl DelegateNote {
        pub fn new(delegator: AztecAddress, delegatee: AztecAddress, randomness: Field) -> Self {
            DelegateNote { delegator, delegatee, randomness, header: NoteHeader::empty() }
        }
    }

    impl Eq for DelegateNote {
        fn eq(self, other: Self) -> bool {
            (self.delegator == other.delegator)
                & (self.delegatee == other.delegatee)
                // NOTE: we don't check for randomness in Eq (1 delegation per delegator)
                // & (self.randomness == other.randomness) 
        }
    }

    impl NullifiableNote for DelegateNote {
        fn compute_nullifier(
            self,
            context: &mut PrivateContext,
            note_hash_for_nullify: Field,
        ) -> Field {
            // the delegatee is the owner of the note (the delegator is used for desambiguation)
            let owner_npk_m_hash = get_public_keys(self.delegatee).npk_m.hash();
            let secret = context.request_nsk_app(owner_npk_m_hash);
            poseidon2_hash_with_separator(
                [note_hash_for_nullify, secret],
                GENERATOR_INDEX__NOTE_NULLIFIER as Field,
            )
        }

        unconstrained fn compute_nullifier_without_context(self) -> Field {
            let note_hash_for_nullify = compute_note_hash_for_nullify(self);
            let owner_npk_m_hash = get_public_keys(self.delegatee).npk_m.hash();
            let secret = get_nsk_app(owner_npk_m_hash);
            poseidon2_hash_with_separator(
                [note_hash_for_nullify, secret],
                GENERATOR_INDEX__NOTE_NULLIFIER as Field,
            )
        }
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
    fn cast_vote(candidate: Field) {
        let msg_sender_npk_m_hash = get_public_keys(context.msg_sender()).npk_m.hash();

        let secret = context.request_nsk_app(msg_sender_npk_m_hash); // get secret key of caller of function
        let nullifier = std::hash::pedersen_hash([context.msg_sender().to_field(), secret]); // derive nullifier from sender and secret
        context.push_nullifier(nullifier);
        EasyPrivateVoting::at(context.this_address()).add_to_tally_public(candidate, 1).enqueue(
            &mut context,
        );
    }

    #[private]
    // sample method for creating a note for someone else to vote on your behalf
    fn delegate_vote(delegatee: AztecAddress, randomness: Field) {
        let msg_sender_npk_m_hash = get_public_keys(context.msg_sender()).npk_m.hash();

        let secret = context.request_nsk_app(msg_sender_npk_m_hash); // get secret key of caller of function
        let nullifier = std::hash::pedersen_hash([context.msg_sender().to_field(), secret]); // derive nullifier from sender and secret
        context.push_nullifier(nullifier);

        let mut delegation = DelegateNote::new(context.msg_sender(), delegatee, randomness);
        storage.delegations.insert(&mut delegation).emit(encode_and_encrypt_note(
            &mut context,
            delegatee,
            context.msg_sender(),
        ));
    }

    #[private]
    fn cast_delegated_vote(candidate: Field) {
        let mut options = NoteGetterOptions::new();
        options = options
            .select(DelegateNote::properties().delegatee, Comparator.EQ, context.msg_sender())
            .set_limit(3); // low limit for testing purposes
        let popped_notes = storage.delegations.pop_notes(options);
        let num_delegated_votes = popped_notes.len() as Field;
        
        EasyPrivateVoting::at(context.this_address()).add_to_tally_public(candidate, num_delegated_votes).enqueue(
            &mut context,
        );
    }


    #[public]
    #[internal]
    fn add_to_tally_public(candidate: Field, amount: Field) {
        assert(storage.vote_ended.read() == false, "Vote has ended"); // assert that vote has not ended
        let num_amount = amount;
        
        let new_tally = storage.tally.at(candidate).read() + num_amount;
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
