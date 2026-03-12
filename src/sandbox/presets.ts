import type { GameState, GamePhase, Trainer, Deck, HubState, WorldMap, Route, RouteNode, Pokemon } from "../../engine/types";
import { createInitialState } from "../../engine/index";
import { resolveAction } from "../../engine/action-resolver";
import { generateTrail } from "../../engine/models/trail";
import { createPokemon, resetPokemonIdCounter } from "../../engine/pokemon/catalog";

// === Types ===

export type PresetPhase = GamePhase;

export interface Preset {
  label: string;
  description: string;
  state: GameState;
  myId: string;
}

// === Helpers ===

/** Replay a sequence of actions on a state, returning the final state. */
function replay(state: GameState, actions: { type: string; [k: string]: unknown }[]): GameState {
  let s = state;
  for (const action of actions) {
    const [next] = resolveAction(s, action as never);
    s = next;
  }
  return s;
}

/** Create a minimal trainer for manual state building. */
function makeTrainer(id: string, name: string, overrides: Partial<Trainer> = {}): Trainer {
  const pokemon = [
    createPokemon("pidgey"),
    createPokemon("pidgey"),
    createPokemon("pidgey"),
    createPokemon("pidgey"),
    createPokemon("rattata"),
    createPokemon("rattata"),
    createPokemon("magikarp"),
    createPokemon("charmander"),
    createPokemon("squirtle"),
    createPokemon("bulbasaur"),
  ];
  const deck: Deck = {
    drawPile: pokemon,
    drawn: [],
    discard: [],
  };
  return {
    id,
    sessionToken: id,
    name,
    avatar: 0,
    deck,
    score: 0,
    bustThreshold: 6,
    currency: 0,
    items: [],
    status: "waiting",
    routeProgress: { totalDistance: 0, totalCost: 0, pokemonDrawn: 0, activeEffects: [], pendingArmorReduction: 0, dudArmorReduction: 0 },
    finalRouteDistance: null,
    finalRouteCost: null,
    bot: false,
    stats: { cardsDrawn: 0, bustCount: 0, maxRouteDistance: 0, totalCurrencyEarned: 0, maxCardDistance: 0, finalDeckSize: 0 },
    pendingThresholdBonus: 0,
    echoes: [],
    draftedAtTier: {},
    usedHexNegate: false,
    ...overrides,
  };
}

/** Build a minimal world map with a start node and two connections. */
function makeMap(): WorldMap {
  const startNode: RouteNode = {
    id: "node_start",
    type: "route",
    bonus: null,
    name: "Ember Trail",
    tier: 0,
    connections: ["node_a", "node_b"],
    bustThreshold: 6,
    modifiers: [],
    visited: true,
    pokemonPool: ["pidgey", "rattata", "charmander", "squirtle"],
    currencyDistribution: { total: 3, curve: "flat" },
  };
  const nodeA: RouteNode = {
    id: "node_a",
    type: "route",
    bonus: "marketplace",
    name: "Misty Hollow",
    tier: 1,
    connections: ["node_c"],
    bustThreshold: 7,
    modifiers: [],
    visited: false,
    pokemonPool: ["pidgey", "rattata", "caterpie", "bulbasaur"],
    currencyDistribution: { total: 3, curve: "flat" },
  };
  const nodeB: RouteNode = {
    id: "node_b",
    type: "elite_route",
    bonus: null,
    name: "Stone Pass",
    tier: 1,
    connections: ["node_c"],
    bustThreshold: 8,
    modifiers: [{ id: "mod1", description: "+1 distance per draw", type: "distance_bonus", value: 1 }],
    visited: false,
    pokemonPool: ["charmander", "squirtle", "bulbasaur"],
    currencyDistribution: { total: 3, curve: "flat" },
  };
  const nodeC: RouteNode = {
    id: "node_c",
    type: "champion",
    bonus: null,
    name: "Champion Summit",
    tier: 2,
    connections: [],
    bustThreshold: 10,
    modifiers: [],
    visited: false,
    pokemonPool: ["charmander", "squirtle", "bulbasaur"],
    currencyDistribution: { total: 3, curve: "flat" },
  };
  return {
    nodes: {
      node_start: startNode,
      node_a: nodeA,
      node_b: nodeB,
      node_c: nodeC,
    },
    currentNodeId: "node_start",
    totalTiers: 3,
  };
}

/** Build a route for use in route-phase presets. */
function makeRoute(trainerIds: string[]): Route {
  const trail = generateTrail({ routeType: "route", tier: 3, totalTiers: 8, currencyDistribution: { total: 3, curve: "flat" } }, Math.random);
  return {
    routeNumber: 1,
    name: "Ember Trail",
    turnOrder: trainerIds,
    currentTurnIndex: 0,
    trainerResults: {},
    status: "in_progress",
    bustThreshold: 6,
    modifiers: [],
    trail,
  };
}

// === Lobby Presets ===

function lobbyEmpty(): Preset {
  return {
    label: "Empty lobby",
    description: "Fresh lobby with no players joined yet.",
    state: createInitialState("SANDBOX"),
    myId: "me",
  };
}

function lobbyThreePlayers(): Preset {
  const state = replay(createInitialState("SANDBOX"), [
    { type: "join_game", trainerName: "Ash", sessionToken: "trainer_ash" },
    { type: "join_game", trainerName: "Misty", sessionToken: "trainer_misty" },
    { type: "join_game", trainerName: "Brock", sessionToken: "trainer_brock" },
  ]);
  return {
    label: "3 players joined",
    description: "Lobby with Ash, Misty, and Brock waiting to start.",
    state,
    myId: "trainer_ash",
  };
}

// === Route Presets ===

function routeMidGame(): Preset {
  const map = makeMap();
  const trainerIds = ["trainer_ash", "trainer_misty"];

  // Build trainers manually: Ash has drawn 2 pokemon, Misty is still exploring
  resetPokemonIdCounter();
  const drawnPokemon1 = createPokemon("pidgey");
  const drawnPokemon2 = createPokemon("pidgey");
  const remainingPokemon = [
    createPokemon("pidgey"),
    createPokemon("pidgey"),
    createPokemon("rattata"),
    createPokemon("rattata"),
    createPokemon("magikarp"),
    createPokemon("charmander"),
    createPokemon("squirtle"),
    createPokemon("bulbasaur"),
  ];

  const ashDeck: Deck = {
    drawPile: remainingPokemon,
    drawn: [drawnPokemon1, drawnPokemon2],
    discard: [],
  };

  const ash: Trainer = {
    id: "trainer_ash",
    sessionToken: "trainer_ash",
    name: "Ash",
    avatar: 0,
    deck: ashDeck,
    score: 0,
    bustThreshold: 6,
    currency: 0,
    items: [],
    status: "exploring",
    routeProgress: {
      totalDistance: drawnPokemon1.distance + drawnPokemon2.distance,
      totalCost: drawnPokemon1.cost + drawnPokemon2.cost,
      pokemonDrawn: 2,
      activeEffects: [],
      pendingArmorReduction: 0,
      dudArmorReduction: 0,
    },
    finalRouteDistance: null,
    finalRouteCost: null,
    bot: false,
    stats: { cardsDrawn: 0, bustCount: 0, maxRouteDistance: 0, totalCurrencyEarned: 0, maxCardDistance: 0, finalDeckSize: 0 },
    pendingThresholdBonus: 0,
    echoes: [],
    draftedAtTier: {},
    usedHexNegate: false,
  };

  const misty = makeTrainer("trainer_misty", "Misty", {
    status: "exploring",
    bustThreshold: 6,
  });

  const state: GameState = {
    gameId: "SANDBOX",
    roomCode: "SANDBOX",
    phase: "route",
    trainers: { trainer_ash: ash, trainer_misty: misty },
    map,
    currentRoute: makeRoute(trainerIds),
    hub: null,
    votes: null,
    routeNumber: 1,
    settings: { maxTrainers: 24, mapTiers: 10, difficulty: "normal" },
    botStrategies: {},
    activeBroadcasts: [],
  };

  return {
    label: "Mid-game (2 drawn)",
    description: "Route in progress. Ash has drawn 2 pokemon, Misty is still exploring.",
    state,
    myId: "trainer_ash",
  };
}

function routeOneBusted(): Preset {
  const map = makeMap();
  const trainerIds = ["trainer_ash", "trainer_misty"];

  // Build Ash as busted: set bustThreshold to 1, cost exceeds it
  resetPokemonIdCounter();
  const drawnPokemon1 = createPokemon("charmander");
  const drawnPokemon2 = createPokemon("squirtle");

  const ashDeck: Deck = {
    drawPile: [createPokemon("pidgey"), createPokemon("pidgey")],
    drawn: [drawnPokemon1, drawnPokemon2],
    discard: [],
  };

  const ash: Trainer = {
    id: "trainer_ash",
    sessionToken: "trainer_ash",
    name: "Ash",
    avatar: 0,
    deck: ashDeck,
    score: 5,
    bustThreshold: 1, // forced low threshold to guarantee bust
    currency: 3,
    items: [],
    status: "busted",
    routeProgress: {
      totalDistance: drawnPokemon1.distance + drawnPokemon2.distance,
      totalCost: drawnPokemon1.cost + drawnPokemon2.cost,
      pokemonDrawn: 2,
      activeEffects: [],
      pendingArmorReduction: 0,
      dudArmorReduction: 0,
    },
    finalRouteDistance: null,
    finalRouteCost: null,
    bot: false,
    stats: { cardsDrawn: 0, bustCount: 0, maxRouteDistance: 0, totalCurrencyEarned: 0, maxCardDistance: 0, finalDeckSize: 0 },
    pendingThresholdBonus: 0,
    echoes: [],
    draftedAtTier: {},
    usedHexNegate: false,
  };

  const misty = makeTrainer("trainer_misty", "Misty", {
    status: "exploring",
    bustThreshold: 6,
  });

  const state: GameState = {
    gameId: "SANDBOX",
    roomCode: "SANDBOX",
    phase: "route",
    trainers: { trainer_ash: ash, trainer_misty: misty },
    map,
    currentRoute: makeRoute(trainerIds),
    hub: null,
    votes: null,
    routeNumber: 1,
    settings: { maxTrainers: 24, mapTiers: 10, difficulty: "normal" },
    botStrategies: {},
    activeBroadcasts: [],
  };

  return {
    label: "One busted",
    description: "Ash has busted (threshold forced to 1). Needs to choose penalty. Misty still exploring.",
    state,
    myId: "trainer_ash",
  };
}

// === Hub Presets ===

function hubFresh(): Preset {
  const map = makeMap();
  const trainerIds = ["trainer_ash", "trainer_misty"];

  resetPokemonIdCounter();
  const freeOffer1 = createPokemon("charmander");
  const freeOffer2 = createPokemon("squirtle");
  const shopPokemon = [
    createPokemon("bulbasaur"),
    createPokemon("pidgey"),
    createPokemon("caterpie"),
  ];

  const shopPrices: Record<string, number> = {};
  for (const p of shopPokemon) {
    shopPrices[p.id] = p.rarity === "common" ? 2 : p.rarity === "uncommon" ? 4 : 7;
  }
  // Free picks have price 0
  shopPrices[freeOffer1.id] = 0;
  shopPrices[freeOffer2.id] = 0;

  const hub: HubState = {
    freePickOffers: {
      trainer_ash: [freeOffer1, freeOffer2],
      trainer_misty: [createPokemon("pidgey"), createPokemon("rattata")],
    },
    shopPokemon,
    shopPrices,
    selections: { trainer_ash: [], trainer_misty: [] },
    confirmedTrainers: [],
  };

  const ash = makeTrainer("trainer_ash", "Ash", { score: 12, currency: 8 });
  const misty = makeTrainer("trainer_misty", "Misty", { score: 9, currency: 5 });

  const state: GameState = {
    gameId: "SANDBOX",
    roomCode: "SANDBOX",
    phase: "hub",
    trainers: { trainer_ash: ash, trainer_misty: misty },
    map,
    currentRoute: null,
    hub,
    votes: null,
    routeNumber: 1,
    settings: { maxTrainers: 24, mapTiers: 10, difficulty: "normal" },
    botStrategies: {},
    activeBroadcasts: [],
  };

  return {
    label: "Fresh hub",
    description: "Just entered the hub after a route. Free picks and shop available.",
    state,
    myId: "trainer_ash",
  };
}

function hubOneConfirmed(): Preset {
  const base = hubFresh();
  const hub = base.state.hub!;

  const state: GameState = {
    ...base.state,
    hub: {
      ...hub,
      confirmedTrainers: ["trainer_misty"],
    },
  };

  return {
    label: "One confirmed",
    description: "Misty has confirmed her selections. Ash still choosing.",
    state,
    myId: "trainer_ash",
  };
}

// === World Presets ===

function worldFresh(): Preset {
  const map = makeMap();

  resetPokemonIdCounter();
  const ash = makeTrainer("trainer_ash", "Ash", { score: 12, currency: 5 });
  const misty = makeTrainer("trainer_misty", "Misty", { score: 9, currency: 3 });

  const state: GameState = {
    gameId: "SANDBOX",
    roomCode: "SANDBOX",
    phase: "world",
    trainers: { trainer_ash: ash, trainer_misty: misty },
    map,
    currentRoute: null,
    hub: null,
    votes: {},
    routeNumber: 1,
    settings: { maxTrainers: 24, mapTiers: 10, difficulty: "normal" },
    botStrategies: {},
    activeBroadcasts: [],
  };

  return {
    label: "Fresh world (no votes)",
    description: "World map phase. No votes cast yet. Two routes available.",
    state,
    myId: "trainer_ash",
  };
}

function worldSomeVoted(): Preset {
  const map = makeMap();

  resetPokemonIdCounter();
  const ash = makeTrainer("trainer_ash", "Ash", { score: 12, currency: 5 });
  const misty = makeTrainer("trainer_misty", "Misty", { score: 9, currency: 3 });

  const state: GameState = {
    gameId: "SANDBOX",
    roomCode: "SANDBOX",
    phase: "world",
    trainers: { trainer_ash: ash, trainer_misty: misty },
    map,
    currentRoute: null,
    hub: null,
    votes: { trainer_misty: "node_a" }, // Misty voted, Ash hasn't
    routeNumber: 1,
    settings: { maxTrainers: 24, mapTiers: 10, difficulty: "normal" },
    botStrategies: {},
    activeBroadcasts: [],
  };

  return {
    label: "Some voted",
    description: "Misty has voted for Misty Hollow. Ash still needs to vote.",
    state,
    myId: "trainer_ash",
  };
}

// === Export ===

export const presets: Record<string, Preset[]> = {
  lobby: [lobbyEmpty(), lobbyThreePlayers()],
  route: [routeMidGame(), routeOneBusted()],
  hub: [hubFresh(), hubOneConfirmed()],
  world: [worldFresh(), worldSomeVoted()],
};
