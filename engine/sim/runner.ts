import type { GameState } from "../types";
import { createInitialState } from "../index";
import { resolveAction } from "../action-resolver";
import type { PlayerStrategy } from "./strategies";
import { autoBustPenalty } from "./strategies";

export interface TrainerResult {
  score: number;
  currency: number;
  bustCount: number;
  stopCount: number;
  totalDrawn: number;
  strategy: string;
}

export interface GameResult {
  finalState: GameState;
  rounds: number;
  trainerStats: Record<string, TrainerResult>;
}

export function runGame(
  playerStrategies: Record<string, PlayerStrategy>,
  maxRounds: number = 100,
): GameResult {
  const trainerIds = Object.keys(playerStrategies);
  const trainerStats: Record<string, TrainerResult> = {};

  for (const [id, strat] of Object.entries(playerStrategies)) {
    trainerStats[id] = {
      score: 0,
      currency: 0,
      bustCount: 0,
      stopCount: 0,
      totalDrawn: 0,
      strategy: strat.name,
    };
  }

  // 1. Create initial state, join all trainers, start game
  let state = createInitialState("sim");

  for (const id of trainerIds) {
    [state] = resolveAction(state, {
      type: "join_game",
      trainerName: id,
      sessionToken: id,
    });
  }

  [state] = resolveAction(state, {
    type: "start_game",
    trainerId: trainerIds[0],
  });

  let rounds = 0;
  const MAX_ACTIONS = 10000; // safety counter
  let actionCount = 0;

  // 2. Main game loop
  while (state.phase !== "game_over" && rounds < maxRounds && actionCount < MAX_ACTIONS) {
    // --- Route phase ---
    if (state.phase === "route") {
      rounds++;
      for (const trainerId of trainerIds) {
        let safetyCounter = 0;
        while (safetyCounter < 200 && actionCount < MAX_ACTIONS) {
          const trainer = state.trainers[trainerId];
          if (!trainer || trainer.status !== "exploring") break;

          try {
            const strategy = playerStrategies[trainerId];
            const action = strategy.route(state, trainerId);
            const [newState] = resolveAction(state, action);
            actionCount++;

            // Track draws
            if (action.type === "hit") {
              trainerStats[trainerId].totalDrawn++;
            }

            state = newState;

            // Check if trainer busted
            const updatedTrainer = state.trainers[trainerId];
            if (updatedTrainer?.status === "busted") {
              trainerStats[trainerId].bustCount++;
              // Auto-choose bust penalty
              try {
                const penaltyAction = autoBustPenalty(trainerId);
                const [penaltyState] = resolveAction(state, penaltyAction);
                actionCount++;
                state = penaltyState;
              } catch {
                // skip on error
              }
              break;
            }

            if (updatedTrainer?.status === "stopped") {
              trainerStats[trainerId].stopCount++;
              break;
            }

            // If the action was "stop", track it
            if (action.type === "stop") {
              trainerStats[trainerId].stopCount++;
              break;
            }
          } catch {
            // skip on error
            break;
          }
          safetyCounter++;
        }
      }
    }

    // --- Hub phase ---
    if (state.phase === "hub") {
      for (const trainerId of trainerIds) {
        if (actionCount >= MAX_ACTIONS) break;
        try {
          const strategy = playerStrategies[trainerId];
          const actions = strategy.hub(state, trainerId);
          for (const action of actions) {
            try {
              const [newState] = resolveAction(state, action);
              actionCount++;
              state = newState;
            } catch {
              // skip on error
            }
          }
        } catch {
          // skip on error
        }
      }

      // If still in hub after all trainers acted, force confirm any remaining
      if (state.phase === "hub") {
        for (const trainerId of trainerIds) {
          if (state.hub && !state.hub.confirmedTrainers.includes(trainerId)) {
            try {
              const [newState] = resolveAction(state, {
                type: "confirm_selections",
                trainerId,
              });
              actionCount++;
              state = newState;
            } catch {
              // skip on error
            }
          }
        }
      }
    }

    // --- World phase ---
    if (state.phase === "world") {
      for (const trainerId of trainerIds) {
        if (actionCount >= MAX_ACTIONS) break;
        const alreadyVoted = state.votes && state.votes[trainerId] !== undefined;
        if (alreadyVoted) continue;

        try {
          const strategy = playerStrategies[trainerId];
          const action = strategy.world(state, trainerId);
          const [newState] = resolveAction(state, action);
          actionCount++;
          state = newState;
        } catch {
          // skip on error
        }
      }
    }
  }

  // 3. Collect final scores/currency
  for (const trainerId of trainerIds) {
    const trainer = state.trainers[trainerId];
    if (trainer) {
      trainerStats[trainerId].score = trainer.score;
      trainerStats[trainerId].currency = trainer.currency;
    }
  }

  return { finalState: state, rounds, trainerStats };
}
