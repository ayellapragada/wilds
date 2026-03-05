import type { GameState, Action, GameEvent, Trainer, RouteProgress } from "./types";
import { createStarterTeam } from "./pokemon/catalog";
import { createDeck, drawPokemon, endTurn } from "./models/deck";
import { freshProgress, createRoute } from "./models/route";
import { resolveMoves } from "./abilities/resolver";
import { handleVote } from "./phases/world";
import { enterHub, handlePickFreePokemon, handleSkipFreePick, handleBuyPokemon, handleReadyUp } from "./phases/hub";
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
    case "pick_free_pokemon":
      return handlePickFreePokemon(state, action);
    case "skip_free_pick":
      return handleSkipFreePick(state, action);
    case "buy_pokemon":
      return handleBuyPokemon(state, action);
    case "ready_up":
      return handleReadyUp(state, action);
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

  const result = drawPokemon(trainer.deck);
  if (!result) return [state, []];
  const [newDeck, pokemon] = result;

  // Resolve moves with pre-draw progress
  const effects = resolveMoves(
    pokemon, "on_draw", trainer.deck.drawn,
    { ...trainer.routeProgress, pokemonDrawn: trainer.routeProgress.pokemonDrawn + 1 },
    trainer.bustThreshold,
  );

  // Apply move effects to modify cost/distance/threshold
  let effectiveCost = pokemon.cost;
  let bonusDistance = 0;
  let thresholdMod = 0;
  let reduceCostAllAmount = 0;
  let reduceCostAllWashAll = false;

  for (const effect of effects) {
    switch (effect.type) {
      case "bonus_distance":
        bonusDistance += effect.amount;
        break;
      case "reduce_cost": {
        if (effect.target === "self") {
          const reduction = effect.amount === "all" ? pokemon.cost : effect.amount;
          effectiveCost = Math.max(0, effectiveCost - reduction);
        } else {
          if (effect.amount === "all") {
            reduceCostAllWashAll = true;
          } else {
            reduceCostAllAmount += effect.amount;
          }
        }
        break;
      }
      case "modify_threshold":
        thresholdMod += effect.amount;
        break;
    }
  }

  let newTotalCost = trainer.routeProgress.totalCost + effectiveCost;
  if (reduceCostAllWashAll) {
    newTotalCost = 0;
  } else if (reduceCostAllAmount > 0) {
    newTotalCost = Math.max(0, newTotalCost - reduceCostAllAmount);
  }

  const progress: RouteProgress = {
    totalDistance: trainer.routeProgress.totalDistance + pokemon.distance + bonusDistance,
    totalCost: newTotalCost,
    pokemonDrawn: trainer.routeProgress.pokemonDrawn + 1,
    activeEffects: effects.length > 0
      ? [...trainer.routeProgress.activeEffects, ...effects]
      : trainer.routeProgress.activeEffects,
  };

  const newThreshold = trainer.bustThreshold + thresholdMod;
  let busted = progress.totalCost > newThreshold;

  const events: GameEvent[] = [
    { type: "pokemon_drawn", trainerId: trainer.id, pokemon, progress },
  ];

  for (const effect of effects) {
    events.push({
      type: "ability_triggered",
      pokemonId: pokemon.id,
      effect,
      description: pokemon.description,
    });
  }

  // Check for on_bust moves across all drawn pokemon
  if (busted) {
    for (const drawn of newDeck.drawn) {
      const bustEffects = resolveMoves(drawn, "on_bust", newDeck.drawn, progress, newThreshold);
      const negation = bustEffects.find(e => e.type === "negate_bust");
      if (negation) {
        busted = false;
        events.push({
          type: "ability_triggered",
          pokemonId: drawn.id,
          effect: negation,
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

  // Track busted trainers from events before resetting
  const bustedTrainerIds: string[] = [];
  for (const e of events) {
    if (e.type === "bust_penalty_chosen") {
      bustedTrainerIds.push(e.trainerId);
    }
  }

  // Build route results
  const results: Record<string, { distance: number; currencyEarned: number; busted: boolean }> = {};
  for (const t of Object.values(state.trainers)) {
    results[t.id] = { distance: t.score, currencyEarned: t.currency, busted: bustedTrainerIds.includes(t.id) };
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

  // Enter hub phase instead of world
  const hubState: GameState = {
    ...state,
    trainers,
    currentRoute: { ...state.currentRoute, status: "complete" },
  };
  const [finalState, hubEvents] = enterHub(hubState, bustedTrainerIds, Math.random);
  events.push(...hubEvents);
  return finalState;
}
