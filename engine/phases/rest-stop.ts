import type { GameState, GameEvent, Trainer, ResolveResult, Pokemon } from "../types";

export function handleRestStopChoice(
  state: GameState,
  action: { type: "rest_stop_choice"; trainerId: string; choice: string; pokemonId?: string },
): ResolveResult {
  if (state.phase !== "rest_stop") return [state, []];
  const trainer = state.trainers[action.trainerId];
  if (!trainer) return [state, []];

  const choices = state.restStopChoices ?? {};
  if (choices[action.trainerId]) return [state, []];

  const events: GameEvent[] = [
    { type: "rest_stop_choice_made", trainerId: action.trainerId, choice: action.choice },
  ];

  let updatedTrainer = trainer;

  switch (action.choice) {
    case "remove": {
      if (!action.pokemonId) return [state, []];
      const removeFromPile = (pile: readonly Pokemon[]) => pile.filter(p => p.id !== action.pokemonId);
      updatedTrainer = {
        ...trainer,
        deck: {
          drawPile: removeFromPile(trainer.deck.drawPile),
          drawn: removeFromPile(trainer.deck.drawn),
          discard: removeFromPile(trainer.deck.discard),
        },
      };
      break;
    }
    case "scout": {
      const top3 = trainer.deck.drawPile.slice(0, 3);
      events.push({
        type: "scout_result",
        trainerId: action.trainerId,
        pokemonIds: top3.map(p => p.id),
      });
      break;
    }
    case "reinforce": {
      updatedTrainer = {
        ...trainer,
        pendingThresholdBonus: trainer.pendingThresholdBonus + 1,
      };
      break;
    }
  }

  const newChoices = { ...choices, [action.trainerId]: action.choice };
  const allChosen = Object.keys(state.trainers).every(id => newChoices[id]);

  const newState: GameState = {
    ...state,
    trainers: { ...state.trainers, [action.trainerId]: updatedTrainer },
    restStopChoices: newChoices,
    phase: allChosen ? "world" : "rest_stop",
    votes: allChosen ? {} : state.votes,
  };

  if (allChosen) {
    events.push({ type: "world_entered" });
  }

  return [newState, events];
}
