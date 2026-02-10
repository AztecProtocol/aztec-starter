use dep::aztec::protocol::{
    address::AztecAddress,
    traits::{Deserialize, Serialize, Packable},
};

// Race struct stores the public state of a game
// This data is visible to everyone and tracks game progress
#[derive(Deserialize, Serialize, Eq, Packable)]
pub struct Race {
    // Player addresses
    pub player1: AztecAddress,
    pub player2: AztecAddress,

    // Game configuration
    pub total_rounds: u8,  // Always 3 for this game

    // Round progress tracking (which round each player is on)
    pub player1_round: u8,
    pub player2_round: u8,

    // Player 1's final revealed track totals (sum of all rounds)
    // Nested structs not working on this version
    pub player1_track1_final: u64,
    pub player1_track2_final: u64,
    pub player1_track3_final: u64,
    pub player1_track4_final: u64,
    pub player1_track5_final: u64,

    // Player 2's final revealed track totals (sum of all rounds)
    pub player2_track1_final: u64,
    pub player2_track2_final: u64,
    pub player2_track3_final: u64,
    pub player2_track4_final: u64,
    pub player2_track5_final: u64,

    // Block number when the game expires (for timeout enforcement)
    pub end_block: u32,
}

impl Race {
    // Creates a new game with player1 set, waiting for player2 to join
    // All track scores initialized to 0, rounds start at 0
    pub fn new(player1: AztecAddress, total_rounds: u8, end_block: u32) -> Race {
        Self {
            player1,
            player2: AztecAddress::zero(),
            total_rounds,
            player1_round: 0,
            player2_round: 0,
            player1_track1_final: 0,
            player1_track2_final: 0,
            player1_track3_final: 0,
            player1_track4_final: 0,
            player1_track5_final: 0,
            player2_track1_final: 0,
            player2_track2_final: 0,
            player2_track3_final: 0,
            player2_track4_final: 0,
            player2_track5_final: 0,
            end_block
        }
    }

    // Adds player2 to an existing game
    // Validates that player1 exists, player2 slot is empty, and player2 is not the same as player1
    pub fn join(self, player2: AztecAddress) -> Race {
        assert(!self.player1.eq(AztecAddress::zero()) & self.player2.eq(AztecAddress::zero()));
        assert(!self.player1.eq(player2));

        Self {
            player1: self.player1,
            player2,
            total_rounds: self.total_rounds,
            player1_round: self.player1_round,
            player2_round: self.player2_round,
            player1_track1_final: 0,
            player1_track2_final: 0,
            player1_track3_final: 0,
            player1_track4_final: 0,
            player1_track5_final: 0,
            player2_track1_final: 0,
            player2_track2_final: 0,
            player2_track3_final: 0,
            player2_track4_final: 0,
            player2_track5_final: 0,
            end_block: self.end_block,
        }
    }

    // Increments a player's round counter after they complete a round
    // Validates:
    // - Round number is within bounds (1-3)
    // - Player is playing rounds sequentially (can't skip rounds)
    pub fn increment_player_round(self, player: AztecAddress, round: u8) -> Race {
        assert(round < self.total_rounds + 1);

        let ret = if player.eq(self.player1) {
            // Ensure player1 is playing the next sequential round
            assert(round == self.player1_round + 1);

            Option::some(Self {
                player1: self.player1,
                player2: self.player2,
                total_rounds: self.total_rounds,
                player1_round: round,
                player2_round: self.player2_round,
                player1_track1_final: self.player1_track1_final,
                player1_track2_final: self.player1_track2_final,
                player1_track3_final: self.player1_track3_final,
                player1_track4_final: self.player1_track4_final,
                player1_track5_final: self.player1_track5_final,
                player2_track1_final: self.player2_track1_final,
                player2_track2_final: self.player2_track2_final,
                player2_track3_final: self.player2_track3_final,
                player2_track4_final: self.player2_track4_final,
                player2_track5_final: self.player2_track5_final,
                end_block: self.end_block
            })
        } else if player.eq(self.player2) {
            assert(round == self.player2_round + 1);

            Option::some(Self {
                player1: self.player1,
                player2: self.player2,
                total_rounds: self.total_rounds,
                player1_round: self.player1_round,
                player2_round: round,
                player1_track1_final: self.player1_track1_final,
                player1_track2_final: self.player1_track2_final,
                player1_track3_final: self.player1_track3_final,
                player1_track4_final: self.player1_track4_final,
                player1_track5_final: self.player1_track5_final,
                player2_track1_final: self.player2_track1_final,
                player2_track2_final: self.player2_track2_final,
                player2_track3_final: self.player2_track3_final,
                player2_track4_final: self.player2_track4_final,
                player2_track5_final: self.player2_track5_final,
                end_block: self.end_block,
            })
        } else {
            Option::none()
        };

        ret.unwrap()
    }

    // Sets a player's final track scores after they reveal them
    // Validates that scores haven't been set yet (all must be 0)
    // This is called from finish_game after summing private round notes
    pub fn set_player_scores(self, player: AztecAddress, track1_final: u64, track2_final: u64, track3_final: u64, track4_final: u64, track5_final: u64) -> Race {
        let ret = if player.eq(self.player1) {
            // Ensure player1 hasn't already revealed (prevents double-reveal exploit)
            assert(
                self.player1_track1_final +
                self.player1_track2_final +
                self.player1_track3_final +
                self.player1_track4_final +
                self.player1_track5_final == 0
            );

            Option::some(Self {
                player1: self.player1,
                player2: self.player2,
                total_rounds: self.total_rounds,
                player1_round: self.player1_round,
                player2_round: self.player2_round,
                player1_track1_final: track1_final,
                player1_track2_final: track2_final,
                player1_track3_final: track3_final,
                player1_track4_final: track4_final,
                player1_track5_final: track5_final,
                player2_track1_final: self.player2_track1_final,
                player2_track2_final: self.player2_track2_final,
                player2_track3_final: self.player2_track3_final,
                player2_track4_final: self.player2_track4_final,
                player2_track5_final: self.player2_track5_final,
                end_block: self.end_block,
            })
        } else if player.eq(self.player2) {
            assert(
                self.player2_track1_final +
                self.player2_track2_final +
                self.player2_track3_final +
                self.player2_track4_final +
                self.player2_track5_final == 0
            );

            Option::some(Self {
                player1: self.player1,
                player2: self.player2,
                total_rounds: self.total_rounds,
                player1_round: self.player1_round,
                player2_round: self.player2_round,
                player1_track1_final: self.player1_track1_final,
                player1_track2_final: self.player1_track2_final,
                player1_track3_final: self.player1_track3_final,
                player1_track4_final: self.player1_track4_final,
                player1_track5_final: self.player1_track5_final,
                player2_track1_final: track1_final,
                player2_track2_final: track2_final,
                player2_track3_final: track3_final,
                player2_track4_final: track4_final,
                player2_track5_final: track5_final,
                end_block: self.end_block,
            })
        } else {
            Option::none()
        };

        ret.unwrap()
    }

    // Determines the game winner by comparing track scores
    // Winner is whoever won more tracks (best of 5)
    //
    // Game rules:
    // - Compare player1 vs player2 score on each of the 5 tracks
    // - Higher score wins that track
    // - Ties go to player2
    // - Player who wins 3+ tracks wins the game
    //
    // Validates that the game has expired (current block > end_block)
    pub fn calculate_winner(self, current_block_number: u32) -> AztecAddress {
        // Ensure game time limit has passed before declaring winner
        assert(current_block_number > self.end_block);

        let mut player1_wins = 0;
        let mut player2_wins = 0;

        // Count how many tracks each player won
        if self.player1_track1_final > self.player2_track1_final {
            player1_wins = player1_wins + 1;
        } else {
            player2_wins = player2_wins + 1;
        };

        if self.player1_track2_final > self.player2_track2_final {
            player1_wins = player1_wins + 1;
        } else {
            player2_wins = player2_wins + 1;
        };

        if self.player1_track3_final > self.player2_track3_final {
            player1_wins = player1_wins + 1;
        } else {
            player2_wins = player2_wins + 1;
        };

        if self.player1_track4_final > self.player2_track4_final {
            player1_wins = player1_wins + 1;
        } else {
            player2_wins = player2_wins + 1;
        };

        if self.player1_track5_final > self.player2_track5_final {
            player1_wins = player1_wins + 1;
        } else {
            player2_wins = player2_wins + 1;
        };

        // Return address of player who won more tracks
        if (player1_wins > player2_wins) {
            self.player1
        } else {
            self.player2
        }
    }
}
