import type { GameState, Action, GameEvent, Trainer, RouteProgress, Route } from "./types";
import { createStarterTeam } from "./creatures/catalog";
import { createDeck, drawCreature, endTurn } from "./models/deck";

export type ResolveResult = [GameState, GameEvent[]];

export function resolveAction(state: GameState, action: Action): ResolveResult {
  switch (action.type) {
    case "join_game":
      return handleJoin(state, action);
    case "start_game":
      return handleStart(state, action);
    case "hit":
      return handleHit(state, action);
    case "stop":
      return handleStop(state, action);
    case "choose_bust_penalty":
      return handleBustPenalty(state, action);
    default:
      return [state, []];
  }
}

// === Lobby ===

function handleJoin(
  state: GameState,
  action: { type: "join_game"; trainerName: string; sessionToken: string }
): ResolveResult {
  if (state.phase !== "lobby") return [state, []];
  if (Object.keys(state.trainers).length >= state.settings.maxTrainers) return [state, []];
  if (state.trainers[action.sessionToken]) return [state, []];

  const trainerId = action.sessionToken;

  const trainer: Trainer = {
    id: trainerId,
    sessionToken: action.sessionToken,
    name: action.trainerName,
    deck: createDeck(createStarterTeam()),
    score: 0,
    bustThreshold: 10,
    baseBustThreshold: 10,
    currency: 0,
    status: "waiting",
    routeProgress: freshProgress(),
  };

  return [
    { ...state, trainers: { ...state.trainers, [trainerId]: trainer } },
    [{ type: "trainer_joined", trainerId, trainerName: action.trainerName }],
  ];
}

function handleStart(
  state: GameState,
  _action: { type: "start_game"; trainerId: string }
): ResolveResult {
  if (state.phase !== "lobby") return [state, []];
  const trainerIds = Object.keys(state.trainers);
  if (trainerIds.length === 0) return [state, []];

  // Set all trainers to exploring
  const trainers: Record<string, Trainer> = {};
  for (const [id, t] of Object.entries(state.trainers)) {
    trainers[id] = { ...t, status: "exploring", routeProgress: freshProgress() };
  }

  const route: Route = {
    routeNumber: 1,
    name: "Route 1",
    turnOrder: trainerIds,
    currentTurnIndex: 0,
    trainerResults: {},
    status: "in_progress",
    modifiers: [],
  };

  return [
    { ...state, phase: "route", trainers, currentRoute: route, routeNumber: 1 },
    [{ type: "route_started", routeNumber: 1, routeName: "Route 1", turnOrder: [...trainerIds], modifiers: [] }],
  ];
}

// === Route Phase ===

function handleHit(
  state: GameState,
  action: { type: "hit"; trainerId: string }
): ResolveResult {
  if (state.phase !== "route") return [state, []];
  const trainer = state.trainers[action.trainerId];
  if (!trainer || trainer.status !== "exploring") return [state, []];

  const result = drawCreature(trainer.deck);
  if (!result) return [state, []];
  const [newDeck, creature] = result;

  const progress: RouteProgress = {
    ...trainer.routeProgress,
    totalDistance: trainer.routeProgress.totalDistance + creature.distance,
    totalCost: trainer.routeProgress.totalCost + creature.cost,
    creaturesDrawn: trainer.routeProgress.creaturesDrawn + 1,
    activeEffects: [],
  };

  const busted = progress.totalCost > trainer.bustThreshold;
  const events: GameEvent[] = [
    { type: "creature_drawn", trainerId: trainer.id, creature, progress },
  ];

  const updatedTrainer: Trainer = {
    ...trainer,
    deck: newDeck,
    routeProgress: progress,
    status: busted ? "busted" : "exploring",
  };

  if (busted) {
    events.push({
      type: "trainer_busted",
      trainerId: trainer.id,
      totalDistance: progress.totalDistance,
      totalCost: progress.totalCost,
    });
  }

  const newState: GameState = {
    ...state,
    trainers: { ...state.trainers, [trainer.id]: updatedTrainer },
  };

  return [newState, events];
}

function handleStop(
  state: GameState,
  action: { type: "stop"; trainerId: string }
): ResolveResult {
  if (state.phase !== "route") return [state, []];
  const trainer = state.trainers[action.trainerId];
  if (!trainer || trainer.status !== "exploring") return [state, []];

  const distanceEarned = trainer.routeProgress.totalDistance;
  const currencyEarned = Math.floor(distanceEarned / 3);

  const events: GameEvent[] = [
    { type: "trainer_stopped", trainerId: trainer.id, totalDistance: distanceEarned },
  ];

  const updatedTrainer: Trainer = {
    ...trainer,
    score: trainer.score + distanceEarned,
    currency: trainer.currency + currencyEarned,
    status: "stopped",
    deck: endTurn(trainer.deck),
    routeProgress: freshProgress(),
  };

  let newState: GameState = {
    ...state,
    trainers: { ...state.trainers, [trainer.id]: updatedTrainer },
  };

  newState = maybeEndRoute(newState, events);
  return [newState, events];
}

function handleBustPenalty(
  state: GameState,
  action: { type: "choose_bust_penalty"; trainerId: string; choice: "keep_score" | "keep_currency" }
): ResolveResult {
  if (state.phase !== "route") return [state, []];
  const trainer = state.trainers[action.trainerId];
  if (!trainer || trainer.status !== "busted") return [state, []];

  const distance = trainer.routeProgress.totalDistance;
  const currency = Math.floor(distance / 3);

  const updatedTrainer: Trainer = {
    ...trainer,
    score: action.choice === "keep_score" ? trainer.score + distance : trainer.score,
    currency: action.choice === "keep_currency" ? trainer.currency + currency : trainer.currency,
    status: "stopped",
    deck: endTurn(trainer.deck),
    routeProgress: freshProgress(),
  };

  const events: GameEvent[] = [
    { type: "bust_penalty_chosen", trainerId: trainer.id, choice: action.choice },
  ];

  let newState: GameState = {
    ...state,
    trainers: { ...state.trainers, [trainer.id]: updatedTrainer },
  };

  newState = maybeEndRoute(newState, events);
  return [newState, events];
}

// === Helpers ===

function freshProgress(): RouteProgress {
  return {
    totalDistance: 0,
    totalCost: 0,
    creaturesDrawn: 0,
    activeEffects: [],
  };
}

function maybeEndRoute(state: GameState, events: GameEvent[]): GameState {
  const allDone = Object.values(state.trainers).every(
    t => t.status === "stopped" || t.status === "waiting"
  );

  if (!allDone || !state.currentRoute) return state;

  // Build route results
  const results: Record<string, { distance: number; currencyEarned: number; busted: boolean }> = {};
  for (const t of Object.values(state.trainers)) {
    results[t.id] = { distance: t.score, currencyEarned: t.currency, busted: false };
  }

  events.push({ type: "route_completed", results });
  events.push({ type: "world_entered" });

  // Transition to world phase — reset trainers to waiting
  const trainers: Record<string, Trainer> = {};
  for (const [id, t] of Object.entries(state.trainers)) {
    trainers[id] = { ...t, status: "waiting", routeProgress: freshProgress() };
  }

  return {
    ...state,
    trainers,
    currentRoute: { ...state.currentRoute, status: "complete" },
    phase: "world",
    votes: {},
  };
}
