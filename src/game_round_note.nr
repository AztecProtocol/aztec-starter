use aztec::{macros::notes::note, protocol_types::{traits::Packable, address::AztecAddress}};

// GameRoundNote is a private note that stores a player's point allocation for one round
// These notes remain private until the player calls finish_game to reveal their totals
//
// Privacy model:
// - Each player creates 3 of these notes (one per round) when playing
// - Only the owner can read their own notes
// - During finish_game, the player sums all their notes and reveals the totals publicly
// - This implements a commit-reveal scheme for fair play
#[derive(Eq, Packable)]
#[note]
pub struct GameRoundNote {
    // Points allocated to each of the 5 tracks in this round
    // Must sum to less than 10 points per round
    pub track1: u8,
    pub track2: u8,
    pub track3: u8,
    pub track4: u8,
    pub track5: u8,

    // Which round this note represents (1, 2, or 3)
    pub round: u8,

    // The player who created this note (only they can read it)
    pub owner: AztecAddress,
}

impl GameRoundNote {
    // Creates a new note with the player's round choices
    // This note gets stored privately and can only be read by the owner
    pub fn new(track1: u8, track2: u8, track3: u8, track4: u8, track5: u8, round: u8, owner: AztecAddress) -> Self {
        Self {
            track1,
            track2,
            track3,
            track4,
            track5,
            round,
            owner,
        }
    }

    // Helper method to access the note data
    pub fn get(self) -> Self {
        Self {
            track1: self.track1,
            track2: self.track2,
            track3: self.track3,
            track4: self.track4,
            track5: self.track5,
            round: self.round,
            owner: self.owner,
        }
    }
}
