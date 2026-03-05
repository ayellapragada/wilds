export type { GameState, Action, GameEvent } from "./types";
export { resolveAction } from "./action-resolver";

import type { GameState } from "./types";

export function createInitialState(roomCode: string): GameState {
  return {
    gameId: roomCode,
    roomCode,
    phase: "lobby",
    players: {},
    map: null,
    currentRound: null,
    shop: null,
    votes: null,
    roundNumber: 0,
    settings: {
      maxPlayers: 8,
      mapTiers: 10,
      difficulty: "normal",
      turnMode: "simultaneous",
    },
  };
}
