// Pod Racing Game Contract
//
// This is a two-player competitive racing game where players allocate points across 5 tracks
// over multiple rounds. The game flow:
// 1. Player 1 creates a game with a time limit
// 2. Player 2 joins the game
// 3. Both players play rounds privately (allocating points across tracks)
// 4. After all rounds, players reveal their total scores per track
// 5. Winner is determined by who won more tracks (best of 5)
//
// Key mechanics:
// - Each round, players distribute up to 9 points across 5 tracks
// - Round choices are private until the finish phase
// - The player with higher total points on a track wins that track
// - The player who wins 3+ tracks wins the game

mod test;
mod game_round_note;
mod race;

use dep::aztec::macros::aztec;

#[aztec]
pub contract PodRacing {
    use dep::aztec::{
        macros::{functions::{external, initializer, only_self}, storage::storage},
        messages::message_delivery::MessageDelivery,
        note::note_getter_options::NoteGetterOptions,
    };
    use dep::aztec::protocol_types::address::AztecAddress;
    use dep::aztec::state_vars::{Map, Owned, PrivateSet, PublicMutable};

    use crate::{game_round_note::GameRoundNote, race::Race};

    // Game configuration constants
    global TOTAL_ROUNDS: u8 = 3; // Each game consists of 3 rounds
    global GAME_LENGTH: u32 = 300; // Games expire after 300 blocks

    #[storage]
    struct Storage<Context> {
        // Contract administrator address
        admin: PublicMutable<AztecAddress, Context>,

        // Maps game_id -> Race struct containing public game state
        // Stores player addresses, round progress, and final track scores
        races: Map<Field, PublicMutable<Race, Context>, Context>,

        // Maps game_id -> player_address -> private notes containing that player's round choices
        // Each GameRoundNote stores the point allocation for one round
        // This data remains private until the player calls finish_game
        progress: Map<Field, Owned<PrivateSet<GameRoundNote, Context>, Context>, Context>,

        // Maps player address -> total number of wins
        // Public leaderboard tracking career victories
        win_history: Map<AztecAddress, PublicMutable<u64, Context>, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor(admin: AztecAddress) {
        self.storage.admin.write(admin);
    }

    // Creates a new game instance
    // The caller becomes player1 and waits for an opponent to join
    // Sets the game expiration to current block + GAME_LENGTH
    #[external("public")]
    fn create_game(game_id: Field) {
        // Ensure this game_id hasn't been used yet (player1 must be zero address)
        assert(self.storage.races.at(game_id).read().player1.eq(AztecAddress::zero()));

        // Initialize a new Race with the caller as player1
        let game = Race::new(
            self.context.msg_sender().unwrap(),
            TOTAL_ROUNDS,
            self.context.block_number() + GAME_LENGTH,
        );
        self.storage.races.at(game_id).write(game);
    }

    // Allows a second player to join an existing game
    // After joining, both players can start playing rounds
    #[external("public")]
    fn join_game(game_id: Field) {
        let maybe_existing_game = self.storage.races.at(game_id).read();

        // Add the caller as player2 (validates that player1 exists and player2 is empty)
        let joined_game = maybe_existing_game.join(self.context.msg_sender().unwrap());
        self.storage.races.at(game_id).write(joined_game);
    }

    // Plays a single round by allocating points across 5 tracks
    // This is a PRIVATE function - the point allocation remains hidden from the opponent
    // Players must play rounds sequentially (round 1, then 2, then 3)
    //
    // Parameters:
    // - track1-5: Points allocated to each track (must sum to less than 10)
    // - round: Which round this is (1, 2, or 3)
    #[external("private")]
    fn play_round(
        game_id: Field,
        round: u8,
        track1: u8,
        track2: u8,
        track3: u8,
        track4: u8,
        track5: u8,
    ) {
        // Validate that total points don't exceed 9 (you can't max out all tracks)
        assert(track1 + track2 + track3 + track4 + track5 < 10);

        let player = self.context.msg_sender().unwrap();

        // Store the round choices privately as a note in the player's own storage
        // This creates a private commitment that can only be read by the player
        self
            .storage
            .progress
            .at(game_id)
            .at(player)
            .insert(GameRoundNote::new(track1, track2, track3, track4, track5, round, player))
            .deliver(MessageDelivery.CONSTRAINED_ONCHAIN);

        // Enqueue a public function call to update the round counter
        // This reveals that a round was played, but not the point allocation
        self.enqueue(PodRacing::at(self.context.this_address()).validate_and_play_round(
            player,
            game_id,
            round,
        ));
    }

    // Internal public function to validate and record that a player completed a round
    // Updates the public game state to track which round each player is on
    // Does NOT reveal the point allocation (that remains private)
    #[external("public")]
    #[only_self]
    fn validate_and_play_round(player: AztecAddress, game_id: Field, round: u8) {
        let game_in_progress = self.storage.races.at(game_id).read();
        // Increment the player's round counter (validates sequential play)
        self.storage.races.at(game_id).write(game_in_progress.increment_player_round(player, round));
    }

    // Called after all rounds are complete to reveal a player's total scores
    // This is PRIVATE - only the caller can read their own GameRoundNotes
    // The function sums up all round allocations per track and publishes totals
    //
    // This is the "reveal" phase where private choices become public
    #[external("private")]
    fn finish_game(game_id: Field) {
        let player = self.context.msg_sender().unwrap();

        // Retrieve all private notes for this player in this game
        let totals =
            self.storage.progress.at(game_id).at(player).get_notes(NoteGetterOptions::new());

        // Sum up points allocated to each track across all rounds
        let mut total_track1: u64 = 0;
        let mut total_track2: u64 = 0;
        let mut total_track3: u64 = 0;
        let mut total_track4: u64 = 0;
        let mut total_track5: u64 = 0;

        // Iterate through exactly TOTAL_ROUNDS notes (only this player's notes)
        for i in 0..TOTAL_ROUNDS {
            total_track1 += totals.get(i as u32).note.track1 as u64;
            total_track2 += totals.get(i as u32).note.track2 as u64;
            total_track3 += totals.get(i as u32).note.track3 as u64;
            total_track4 += totals.get(i as u32).note.track4 as u64;
            total_track5 += totals.get(i as u32).note.track5 as u64;
        }

        // Enqueue public function to store the revealed totals on-chain
        // Now the revealing player's track totals will be publicly visible
        self.enqueue(PodRacing::at(self.context.this_address()).validate_finish_game_and_reveal(
            player,
            game_id,
            total_track1,
            total_track2,
            total_track3,
            total_track4,
            total_track5,
        ));
    }

    // Internal public function to store a player's revealed track totals
    // Validates that the player hasn't already revealed their scores (all must be 0)
    // After both players call finish_game, all scores are public and can be compared
    #[external("public")]
    #[only_self]
    fn validate_finish_game_and_reveal(
        player: AztecAddress,
        game_id: Field,
        total_track1: u64,
        total_track2: u64,
        total_track3: u64,
        total_track4: u64,
        total_track5: u64,
    ) {
        let game_in_progress = self.storage.races.at(game_id).read();

        // Store the player's track totals (validates they haven't been set yet)
        self.storage.races.at(game_id).write(game_in_progress.set_player_scores(
            player,
            total_track1,
            total_track2,
            total_track3,
            total_track4,
            total_track5,
        ));
    }

    // Determines the winner after both players have revealed their scores
    // Can only be called after the game's end_block (time limit expired)
    // Compares track totals and declares the player who won more tracks as winner
    //
    // Winner determination:
    // - Compare each of the 5 tracks
    // - Player with higher total on a track wins that track
    // - Player who wins 3+ tracks wins the game (best of 5)
    // - Updates the winner's career win count
    #[external("public")]
    fn finalize_game(game_id: Field) {
        let game_in_progress = self.storage.races.at(game_id).read();

        // Calculate winner by comparing track scores (validates game has ended)
        let winner = game_in_progress.calculate_winner(self.context.block_number());

        // Update the winner's total win count in the public leaderboard
        let previous_wins = self.storage.win_history.at(winner).read();
        self.storage.win_history.at(winner).write(previous_wins + 1);
    }

    // Returns the current state of a game
    // Useful for frontends to display game progress
    #[external("utility")]
    unconstrained fn get_game_state(game_id: Field) -> pub Race {
        self.storage.races.at(game_id).read()
    }

    // Returns the total career wins for a player
    #[external("utility")]
    unconstrained fn get_player_wins(player: AztecAddress) -> pub u64 {
        self.storage.win_history.at(player).read()
    }

    // Allows player1 to cancel a game if player2 hasn't joined yet
    // Useful if no opponent shows up and player1 wants to reclaim the game slot
    #[external("public")]
    fn cancel_game(game_id: Field) {
        let game = self.storage.races.at(game_id).read();

        // Only player1 can cancel
        assert(game.player1.eq(self.context.msg_sender().unwrap()));

        // Can only cancel if no player2 has joined
        assert(game.player2.eq(AztecAddress::zero()));

        // Reset the game slot by writing a zeroed Race
        self.storage.races.at(game_id).write(Race::empty());
    }

    // Allows a player to forfeit an in-progress game
    // The opponent is automatically awarded the win
    // Can only be called after player2 has joined (game has started)
    #[external("public")]
    fn forfeit_game(game_id: Field) {
        let game = self.storage.races.at(game_id).read();
        let caller = self.context.msg_sender().unwrap();

        // Game must have started (player2 joined)
        assert(!game.player2.eq(AztecAddress::zero()), "Game has not started yet");

        // Get the opponent (also validates caller is a player)
        let winner = game.get_opponent(caller);

        // Award the win to the opponent
        let previous_wins = self.storage.win_history.at(winner).read();
        self.storage.win_history.at(winner).write(previous_wins + 1);

        // Reset the game slot
        self.storage.races.at(game_id).write(Race::empty());
    }
}
