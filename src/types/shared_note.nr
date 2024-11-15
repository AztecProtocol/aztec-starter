use dep::aztec::{
    context::PrivateContext,
    macros::notes::note,
    note::{
        note_header::NoteHeader, note_interface::NullifiableNote,
        utils::compute_note_hash_for_nullify,
    },
    prelude::AztecAddress,
    protocol_types::{
        constants::GENERATOR_INDEX__NOTE_NULLIFIER,
        hash::poseidon2_hash_with_separator,
        traits::{Deserialize, Serialize},
    },
};

/// @member alice: the user who shares the note
/// @member bob: the user who the note is shared with
/// @member shared_nullifier_key: the key used to nullify the note
#[note]
#[derive(Serialize, Deserialize)]
pub struct SharedNote {
    alice: AztecAddress, // msg_sender
    bob: AztecAddress, // inputted by msg_sender
    shared_nullifier_key: Field, // oracle::random
}

/// @notice Declare the length of the note.
global SHARED_NOTE_LEN: Field = 4;

impl SharedNote {
    pub fn new(alice: AztecAddress, bob: AztecAddress, shared_nullifier_key: Field) -> Self {
        SharedNote { alice, bob, shared_nullifier_key, header: NoteHeader::empty() }
    }
}

impl Eq for SharedNote {
    fn eq(self, other: SharedNote) -> bool {
        self.alice.eq(other.alice)
            & self.bob.eq(other.bob)
            & self.shared_nullifier_key.eq(other.shared_nullifier_key)
    }
}

impl NullifiableNote for SharedNote {
    fn compute_nullifier(
        self,
        context: &mut PrivateContext,
        note_hash_for_nullify: Field,
    ) -> Field {
        // let note_hash_for_nullify = compute_note_hash_for_nullify(self);
        poseidon2_hash_with_separator(
            [self.shared_nullifier_key],
            GENERATOR_INDEX__NOTE_NULLIFIER as Field,
        )
    }

    unconstrained fn compute_nullifier_without_context(self) -> Field {
        // let note_hash_for_nullify = compute_note_hash_for_nullify(self);
        poseidon2_hash_with_separator(
            [self.shared_nullifier_key],
            GENERATOR_INDEX__NOTE_NULLIFIER as Field,
        )
    }
}
