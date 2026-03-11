import type { GameState, Action } from "../types";

export type RouteStrategy = (state: GameState, trainerId: string) => Action;
export type HubStrategy = (state: GameState, trainerId: string) => Action[];
export type WorldStrategy = (state: GameState, trainerId: string) => Action;
export type RestStopStrategy = (state: GameState, trainerId: string) => Action;
export type EventStrategy = (state: GameState, trainerId: string) => Action;

export interface PlayerStrategy {
  name: string;
  route: RouteStrategy;
  hub: HubStrategy;
  world: WorldStrategy;
  restStop: RestStopStrategy;
  event: EventStrategy;
}

// --- Route strategies ---

const aggressive: RouteStrategy = (_state, trainerId) => {
  return { type: "hit", trainerId };
};

const conservative: RouteStrategy = (state, trainerId) => {
  const trainer = state.trainers[trainerId];
  if (!trainer) return { type: "stop", trainerId };

  const costRatio = trainer.routeProgress.totalCost / trainer.bustThreshold;
  if (costRatio > 0.6 || trainer.routeProgress.pokemonDrawn >= 3) {
    return { type: "stop", trainerId };
  }
  return { type: "hit", trainerId };
};

const random: RouteStrategy = (state, trainerId) => {
  const trainer = state.trainers[trainerId];
  if (!trainer) return { type: "stop", trainerId };

  // Must hit at least once
  if (trainer.routeProgress.pokemonDrawn === 0) {
    return { type: "hit", trainerId };
  }

  return Math.random() < 0.5
    ? { type: "hit", trainerId }
    : { type: "stop", trainerId };
};

// --- Hub strategy ---

function autoHub(state: GameState, trainerId: string): Action[] {
  const actions: Action[] = [];
  const hub = state.hub;
  if (!hub) return [{ type: "confirm_selections", trainerId }];

  const freeOffers = hub.freePickOffers[trainerId] ?? [];

  // Select free picks (up to max 2 selections total)
  let selected = 0;
  for (const pokemon of freeOffers) {
    if (selected >= 2) break;
    actions.push({ type: "select_pokemon", trainerId, pokemonId: pokemon.id });
    selected++;
  }

  actions.push({ type: "confirm_selections", trainerId });
  return actions;
}

// --- World strategy ---

function autoWorld(state: GameState, trainerId: string): Action {
  const map = state.map;
  if (!map) return { type: "cast_vote", trainerId, nodeId: "" };

  const current = map.nodes[map.currentNodeId];
  const connections = current.connections;
  const nodeId = connections[Math.floor(Math.random() * connections.length)];
  return { type: "cast_vote", trainerId, nodeId };
}

// --- Bust penalty helper ---

export function autoBustPenalty(trainerId: string): Action {
  return { type: "choose_bust_penalty", trainerId, choice: "keep_score" };
}

// --- Rest stop strategy ---

const autoRestStop: RestStopStrategy = (_state, trainerId) => {
  return { type: "rest_stop_choice", trainerId, choice: "reinforce" };
};

// --- Event strategy ---

const autoEvent: EventStrategy = (_state, trainerId) => {
  return { type: "continue_event", trainerId };
};

// --- Built-in strategies ---

export const strategies: Record<string, PlayerStrategy> = {
  aggressive: {
    name: "aggressive",
    route: aggressive,
    hub: autoHub,
    world: autoWorld,
    restStop: autoRestStop,
    event: autoEvent,
  },
  conservative: {
    name: "conservative",
    route: conservative,
    hub: autoHub,
    world: autoWorld,
    restStop: autoRestStop,
    event: autoEvent,
  },
  random: {
    name: "random",
    route: random,
    hub: autoHub,
    world: autoWorld,
    restStop: autoRestStop,
    event: autoEvent,
  },
};
