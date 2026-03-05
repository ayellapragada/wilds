export type { GameState, Action, GameEvent } from "./types";
export { resolveAction } from "./action-resolver";

import type { GameState } from "./types";

export function createInitialState(roomCode: string): GameState {
  return {
    gameId: roomCode,
    roomCode,
    phase: "lobby",
    trainers: {},
    map: null,
    currentRoute: null,
    marketplace: null,
    votes: null,
    routeNumber: 0,
    settings: {
      maxTrainers: 8,
      mapTiers: 10,
      difficulty: "normal",
    },
  };
}
