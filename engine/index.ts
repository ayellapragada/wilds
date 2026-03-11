export type { GameState, Action, GameEvent, TVViewState, PhoneViewState, TrainerPublicInfo, ConnectionInfo, ConnectionRole, AvatarId, Superlative } from "./types";
export { resolveAction } from "./action-resolver";
export { createTVView, createPhoneView } from "./views";

import type { GameState } from "./types";

export function createInitialState(roomCode: string): GameState {
  return {
    gameId: roomCode,
    roomCode,
    phase: "lobby",
    trainers: {},
    map: null,
    currentRoute: null,
    hub: null,
    votes: null,
    routeNumber: 0,
    settings: {
      maxTrainers: 24,
      mapTiers: 10,
      difficulty: "normal",
    },
    botStrategies: {},
    superlatives: [],
    event: null,
    restStopChoices: null,
  };
}
