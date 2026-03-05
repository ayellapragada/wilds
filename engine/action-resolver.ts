import type { GameState, Action, GameEvent, Trainer, RouteProgress } from "./types";
import { createStarterTeam } from "./creatures/catalog";
import { createDeck, drawCreature, endTurn } from "./models/deck";
import { freshProgress, createRoute } from "./models/route";
import { resolveAbility } from "./abilities/resolver";
import { handleVote } from "./phases/world";
import { generateMap } from "./map-generator";

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
    case "cast_vote":
      return handleVote(state, action, Math.random);
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

  // Generate the world map
  const map = generateMap(state.settings.mapTiers, Math.random);
  const startNodeId = map.currentNodeId;
  const startNode = map.nodes[startNodeId];
  const updatedMap = {
    ...map,
    nodes: {
      ...map.nodes,
      [startNodeId]: { ...startNode, visited: true },
    },
  };

  // Set all trainers to exploring
  const trainers: Record<string, Trainer> = {};
  for (const [id, t] of Object.entries(state.trainers)) {
    trainers[id] = { ...t, status: "exploring", routeProgress: freshProgress() };
  }

  const route = createRoute(1, startNode, trainerIds);

  return [
    { ...state, phase: "route", trainers, currentRoute: route, routeNumber: 1, map: updatedMap },
    [
      { type: "game_started", map: updatedMap },
      { type: "route_started", routeNumber: 1, routeName: startNode.name, turnOrder: [...trainerIds], modifiers: [...startNode.modifiers] },
    ],
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

  // Resolve ability with pre-draw progress (so would_bust checks cost + creature.cost correctly)
  const effect = resolveAbility(
    creature, "on_draw", trainer.deck.drawn,
    { ...trainer.routeProgress, creaturesDrawn: trainer.routeProgress.creaturesDrawn + 1 },
    trainer.bustThreshold,
  );

  // Apply ability effects to modify cost/distance/threshold
  let effectiveCost = creature.cost;
  let bonusDistance = 0;
  let thresholdMod = 0;

  if (effect) {
    switch (effect.type) {
      case "bonus_distance":
        bonusDistance = effect.amount;
        break;
      case "reduce_cost": {
        if (effect.target === "self") {
          const reduction = effect.amount === "all" ? creature.cost : effect.amount;
          effectiveCost = Math.max(0, creature.cost - reduction);
        }
        // "all" target handled after cost is added
        break;
      }
      case "modify_threshold":
        thresholdMod = effect.amount;
        break;
    }
  }

  let newTotalCost = trainer.routeProgress.totalCost + effectiveCost;
  if (effect && effect.type === "reduce_cost" && effect.target === "all") {
    const reduction = effect.amount === "all" ? newTotalCost : effect.amount;
    newTotalCost = Math.max(0, newTotalCost - reduction);
  }

  const progress: RouteProgress = {
    totalDistance: trainer.routeProgress.totalDistance + creature.distance + bonusDistance,
    totalCost: newTotalCost,
    creaturesDrawn: trainer.routeProgress.creaturesDrawn + 1,
    activeEffects: effect
      ? [...trainer.routeProgress.activeEffects, effect]
      : trainer.routeProgress.activeEffects,
  };

  const newThreshold = trainer.bustThreshold + thresholdMod;
  let busted = progress.totalCost > newThreshold;

  const events: GameEvent[] = [
    { type: "creature_drawn", trainerId: trainer.id, creature, progress },
  ];

  if (effect) {
    events.push({
      type: "ability_triggered",
      creatureId: creature.id,
      effect,
      description: creature.description,
    });
  }

  // Check for on_bust abilities across all drawn creatures
  if (busted) {
    for (const drawn of newDeck.drawn) {
      const bustEffect = resolveAbility(drawn, "on_bust", newDeck.drawn, progress, newThreshold);
      if (bustEffect?.type === "negate_bust") {
        busted = false;
        events.push({
          type: "ability_triggered",
          creatureId: drawn.id,
          effect: bustEffect,
          description: drawn.description,
        });
        break;
      }
    }
  }

  const updatedTrainer: Trainer = {
    ...trainer,
    deck: newDeck,
    routeProgress: progress,
    bustThreshold: newThreshold,
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

  // Reset trainers to waiting
  const trainers: Record<string, Trainer> = {};
  for (const [id, t] of Object.entries(state.trainers)) {
    trainers[id] = { ...t, status: "waiting", routeProgress: freshProgress() };
  }

  events.push({ type: "route_completed", results });

  // Check if this was the champion route → game over
  if (state.map) {
    const currentNode = state.map.nodes[state.map.currentNodeId];
    if (currentNode?.type === "champion") {
      const finalScores: Record<string, number> = {};
      let championId = "";
      let highScore = -1;
      for (const t of Object.values(trainers)) {
        finalScores[t.id] = t.score;
        if (t.score > highScore) {
          highScore = t.score;
          championId = t.id;
        }
      }

      events.push({ type: "game_over", finalScores, championId });

      return {
        ...state,
        trainers,
        currentRoute: { ...state.currentRoute, status: "complete" },
        phase: "game_over",
        votes: null,
      };
    }
  }

  events.push({ type: "world_entered" });

  return {
    ...state,
    trainers,
    currentRoute: { ...state.currentRoute, status: "complete" },
    phase: "world",
    votes: {},
  };
}
