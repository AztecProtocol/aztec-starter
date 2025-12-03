// mod test;
mod game_round_note;
mod race;

use dep::aztec::macros::aztec;

#[aztec]
pub contract PodRacing {
    use dep::aztec::{
        note::note_getter_options::NoteGetterOptions,
        messages::message_delivery::MessageDelivery,
        macros::{functions::{external, initializer, internal}, storage::storage},
    };
    use dep::aztec::protocol_types::address::AztecAddress;
    use dep::aztec::state_vars::{Map, PublicMutable, PrivateSet};

    use crate::{game_round_note::GameRoundNote, race::Race};

    global TOTAL_ROUNDS: u8 = 3;
    global GAME_LENGTH: u32 = 300;

    #[storage]
    struct Storage<Context> {
        admin: PublicMutable<AztecAddress, Context>,
        races: Map<Field, PublicMutable<Race, Context>, Context>,
        progress: Map<Field, PrivateSet<GameRoundNote, Context>, Context>,
        win_history: Map<AztecAddress, PublicMutable<u64, Context>, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor(admin: AztecAddress) {
        storage.admin.write(admin);
    }

    #[external("public")]
    fn create_game(game_id: Field) {
        assert(storage.races.at(game_id).read().player1.eq(AztecAddress::zero()));

        let game = Race::new(context.msg_sender().unwrap(), TOTAL_ROUNDS, context.block_number() + GAME_LENGTH);
        storage.races.at(game_id).write(game);
    }

    #[external("public")]
    fn join_game(game_id: Field) {
        let maybe_existing_game = storage.races.at(game_id).read();

        let joined_game = maybe_existing_game.join(context.msg_sender().unwrap());
        storage.races.at(game_id).write(joined_game);
    }

    #[external("private")]
    fn play_round(game_id: Field, round: u8, track1: u8, track2: u8, track3: u8, track4: u8, track5: u8) {
        assert(track1 + track2 + track3 + track4 + track5 < 10);

        storage.progress.at(game_id).insert(GameRoundNote::new(
            track1,
            track2,
            track3,
            track4,
            track5,
            round,
            context.msg_sender().unwrap(),
        )).emit(context.msg_sender().unwrap(), MessageDelivery.CONSTRAINED_ONCHAIN);

        PodRacing::at(context.this_address()).validate_and_play_round(context.msg_sender().unwrap(), game_id, round).enqueue(
            &mut context,
        );
    }

    #[external("public")]
    #[internal]
    fn validate_and_play_round(player: AztecAddress, game_id: Field, round: u8) {
        let game_in_progress = storage.races.at(game_id).read();
        storage.races.at(game_id).write(game_in_progress.increment_player_round(player, round));
    }

    #[external("private")]
    fn finish_game(player: AztecAddress, game_id: Field, round: u8) {
        let totals = storage.progress.at(game_id).get_notes(NoteGetterOptions::new());

        let mut total_track1: u64= 0;
        let mut total_track2: u64= 0;
        let mut total_track3: u64= 0;
        let mut total_track4: u64= 0;
        let mut total_track5: u64= 0;

        for i in 0..TOTAL_ROUNDS {
            total_track1 += totals.get(i as u32).note.track1 as u64;
            total_track2 += totals.get(i as u32).note.track2 as u64;
            total_track3 += totals.get(i as u32).note.track3 as u64;
            total_track4 += totals.get(i as u32).note.track4 as u64;
            total_track5 += totals.get(i as u32).note.track5 as u64;
        }

        PodRacing::at(context.this_address()).validate_finish_game_and_reveal(
            context.msg_sender().unwrap(),
            game_id,
            total_track1,
            total_track2,
            total_track3,
            total_track4,
            total_track5,
            ).enqueue(
            &mut context,
        );
    }

    #[external("public")]
    #[internal]
    fn validate_finish_game_and_reveal(
        player: AztecAddress,
        game_id: Field,
        total_track1: u64,
        total_track2: u64,
        total_track3: u64,
        total_track4: u64,
        total_track5: u64
    ) {
        let game_in_progress = storage.races.at(game_id).read();
    
        storage.races.at(game_id).write(game_in_progress.set_player_scores(player, total_track1, total_track2, total_track3, total_track4, total_track5));
    }

    #[external("public")]
    fn finalize_game(
        game_id: Field
    ) {
        let game_in_progress = storage.races.at(game_id).read();

        let winner = game_in_progress.calculate_winner(context.block_number());

        let previous_wins = storage.win_history.at(winner).read();

        storage.win_history.at(winner).write(previous_wins + 1);
    }
}
