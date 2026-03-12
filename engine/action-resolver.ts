import type { GameState, Action, GameEvent, Trainer, TrainerStats, RouteProgress, ResolveResult, Trail, RouteEvent, AvatarId, Pokemon, RouteModifier, ActiveBroadcast, EchoEntry } from "./types";
import type { AbilityEffect } from "./abilities/types";
import { collapseBroadcasts, applyBroadcasts } from "./models/broadcast";
import { createStarterTeam } from "./pokemon/catalog";
import { createDeck, drawPokemon, endTurn } from "./models/deck";
import { freshProgress, createRoute } from "./models/route";
import { getTrailPosition } from "./models/trail";
import { resolveMoves } from "./abilities/resolver";
import { handleVote } from "./phases/world";
import { enterHub, handleSelectPokemon, handleConfirmSelections } from "./phases/hub";
import { evolveDeck } from "./pokemon/evolution";
import { handleRestStopChoice } from "./phases/rest-stop";
import { generateEvent } from "./phases/event";
import { generateMap } from "./map-generator";
import { calculateSuperlatives } from "./models/superlatives";

export type { ResolveResult } from "./types";

const AVATAR_COUNT = 38;

function freshStats(): TrainerStats {
  return { cardsDrawn: 0, bustCount: 0, maxRouteDistance: 0, totalCurrencyEarned: 0, maxCardDistance: 0, finalDeckSize: 0 };
}

function takenAvatars(state: GameState): Set<AvatarId> {
  return new Set(Object.values(state.trainers).map(t => t.avatar));
}

function randomUntakenAvatar(state: GameState): AvatarId {
  const taken = takenAvatars(state);
  const available: number[] = [];
  for (let i = 0; i < AVATAR_COUNT; i++) {
    if (!taken.has(i)) available.push(i);
  }
  if (available.length === 0) return Math.floor(Math.random() * AVATAR_COUNT);
  return available[Math.floor(Math.random() * available.length)];
}

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
    case "select_pokemon":
      return handleSelectPokemon(state, action);
    case "confirm_selections":
      return handleConfirmSelections(state, action);
    case "add_bot":
      return handleAddBot(state, action);
    case "remove_bot":
      return handleRemoveBot(state, action);
    case "select_avatar":
      return handleSelectAvatar(state, action);
    case "play_again":
      return handlePlayAgain(state);
    case "continue_event":
      return handleContinueEvent(state);
    case "rest_stop_choice":
      return handleRestStopChoice(state, action);
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
    avatar: randomUntakenAvatar(state),
    deck: createDeck(createStarterTeam()),
    score: 0,
    bustThreshold: 0,
    currency: 0,
    items: [],
    status: "waiting",
    routeProgress: freshProgress(),
    finalRouteDistance: null,
    finalRouteCost: null,
    bot: false,
    stats: freshStats(),
    pendingThresholdBonus: 0,
    echoes: [],
    draftedAtTier: {},
    usedHexNegate: false,
  };

  return [
    { ...state, trainers: { ...state.trainers, [trainerId]: trainer } },
    [{ type: "trainer_joined", trainerId, trainerName: action.trainerName }],
  ];
}

function handleAddBot(
  state: GameState,
  action: { type: "add_bot"; strategy: "aggressive" | "conservative" | "random" }
): ResolveResult {
  if (state.phase !== "lobby") return [state, []];
  if (Object.keys(state.trainers).length >= state.settings.maxTrainers) return [state, []];

  const botCount = Object.keys(state.trainers).filter(id => id.startsWith("bot_")).length;
  const botNum = botCount + 1;
  const trainerId = `bot_${botNum}`;

  const trainer: Trainer = {
    id: trainerId,
    sessionToken: "",
    name: `Bot ${botNum}`,
    avatar: randomUntakenAvatar(state),
    deck: createDeck(createStarterTeam()),
    score: 0,
    bustThreshold: 0,
    currency: 0,
    items: [],
    status: "waiting",
    routeProgress: freshProgress(),
    finalRouteDistance: null,
    finalRouteCost: null,
    bot: true,
    stats: freshStats(),
    pendingThresholdBonus: 0,
    echoes: [],
    draftedAtTier: {},
    usedHexNegate: false,
  };

  return [
    {
      ...state,
      trainers: { ...state.trainers, [trainerId]: trainer },
      botStrategies: { ...state.botStrategies, [trainerId]: action.strategy },
    },
    [{ type: "trainer_joined", trainerId, trainerName: trainer.name }],
  ];
}

function handleRemoveBot(
  state: GameState,
  action: { type: "remove_bot"; trainerId: string }
): ResolveResult {
  if (state.phase !== "lobby") return [state, []];
  const trainer = state.trainers[action.trainerId];
  if (!trainer || !trainer.bot) return [state, []];

  const { [action.trainerId]: _, ...remainingTrainers } = state.trainers;
  const { [action.trainerId]: __, ...remainingStrategies } = state.botStrategies;

  return [
    { ...state, trainers: remainingTrainers, botStrategies: remainingStrategies },
    [{ type: "trainer_left", trainerId: action.trainerId }],
  ];
}

function handleSelectAvatar(
  state: GameState,
  action: { type: "select_avatar"; trainerId: string; avatar: AvatarId }
): ResolveResult {
  if (state.phase !== "lobby") return [state, []];
  const trainer = state.trainers[action.trainerId];
  if (!trainer) return [state, []];

  const taken = takenAvatars(state);
  taken.delete(trainer.avatar);
  if (taken.has(action.avatar)) return [state, []];

  const updated: Trainer = { ...trainer, avatar: action.avatar };
  return [{ ...state, trainers: { ...state.trainers, [action.trainerId]: updated } }, []];
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
    trainers[id] = { ...t, status: "exploring", bustThreshold: startNode.bustThreshold + t.pendingThresholdBonus, pendingThresholdBonus: 0, routeProgress: freshProgress(), finalRouteDistance: null, stats: freshStats() };
  }

  const route = createRoute(1, startNode, trainerIds, Math.random, map.totalTiers);

  if (startNode.bonus === "event") {
    const event = generateEvent(startNode.tier, updatedMap.totalTiers, Math.random);
    if (event) {
      return [
        { ...state, phase: "event", trainers, currentRoute: route, routeNumber: 1, map: updatedMap, event, superlatives: [] },
        [
          { type: "game_started", map: updatedMap },
          { type: "event_started", event },
        ],
      ];
    }
  }

  return [
    { ...state, phase: "route", trainers, currentRoute: route, routeNumber: 1, map: updatedMap },
    [
      { type: "game_started", map: updatedMap },
      { type: "route_started", routeNumber: 1, routeName: startNode.name, turnOrder: [...trainerIds], modifiers: [...startNode.modifiers] },
    ],
  ];
}

// === Route Phase ===

/** Process a single drawn pokemon: resolve effects, apply cost/distance/threshold mods, apply armor. */
function processDrawnPokemon(
  pokemon: Pokemon,
  drawnSoFar: readonly Pokemon[],
  currentProgress: RouteProgress,
  bustThreshold: number,
  routeModifiers: readonly RouteModifier[],
): {
  effects: AbilityEffect[];
  effectiveCost: number;
  bonusDistance: number;
  thresholdMod: number;
  reduceCostAllAmount: number;
  reduceCostAllWashAll: boolean;
  pendingArmorReduction: number;
  dudArmorReduction: number;
} {
  const effects = resolveMoves(
    pokemon, "on_draw", drawnSoFar,
    { ...currentProgress, pokemonDrawn: currentProgress.pokemonDrawn + 1 },
    bustThreshold,
  );

  let effectiveCost = pokemon.cost;
  let bonusDistance = 0;
  let thresholdMod = 0;
  let reduceCostAllAmount = 0;
  let reduceCostAllWashAll = false;
  let pendingArmorReduction = 0;
  let dudArmorReduction = 0;

  // Apply pending armor reduction from previous card
  if (currentProgress.pendingArmorReduction > 0) {
    effectiveCost = Math.max(0, effectiveCost - currentProgress.pendingArmorReduction);
  }

  // Apply dud armor reduction if this card is a dud (no moves)
  if (pokemon.moves.length === 0 && currentProgress.dudArmorReduction > 0) {
    effectiveCost = Math.max(0, effectiveCost - currentProgress.dudArmorReduction);
  }

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
      case "armor": {
        if (effect.target === "next") {
          pendingArmorReduction += effect.amount;
        } else if (effect.target === "duds") {
          dudArmorReduction += effect.amount;
        } else if (effect.target === "all") {
          reduceCostAllAmount += effect.amount;
        }
        break;
      }
    }
  }

  // Apply route modifiers
  for (const modifier of routeModifiers) {
    switch (modifier.type) {
      case "distance_bonus":
        bonusDistance += modifier.value;
        break;
      case "cost_bonus":
        effectiveCost = Math.max(0, effectiveCost + modifier.value);
        break;
      case "threshold_modifier":
        thresholdMod += modifier.value;
        break;
      case "type_bonus":
        if (modifier.targetType && pokemon.types.includes(modifier.targetType)) {
          bonusDistance += modifier.value;
        }
        break;
    }
  }

  return { effects, effectiveCost, bonusDistance, thresholdMod, reduceCostAllAmount, reduceCostAllWashAll, pendingArmorReduction, dudArmorReduction };
}

function handleHit(
  state: GameState,
  action: { type: "hit"; trainerId: string }
): ResolveResult {
  if (state.phase !== "route") return [state, []];
  const trainer = state.trainers[action.trainerId];
  if (!trainer || trainer.status !== "exploring") return [state, []];

  // Echo trigger: fire echoes on first draw of a new route
  let echoEvents: GameEvent[] = [];
  let updatedEchoes = trainer.echoes;
  if (trainer.routeProgress.pokemonDrawn === 0 && trainer.echoes.length > 0) {
    for (const echo of trainer.echoes) {
      echoEvents.push({
        type: "echo_triggered",
        trainerId: trainer.id,
        pokemonId: echo.pokemonId,
        effect: echo.effect,
      });
    }
    updatedEchoes = [];
  }

  const result = drawPokemon(trainer.deck);
  if (!result) return [state, []];
  let [currentDeck, pokemon] = result;

  const routeModifiers = state.currentRoute!.modifiers;

  const processed = processDrawnPokemon(
    pokemon, trainer.deck.drawn, trainer.routeProgress, trainer.bustThreshold, routeModifiers,
  );

  let { effectiveCost, bonusDistance, thresholdMod, reduceCostAllAmount, reduceCostAllWashAll } = processed;
  let allEffects = [...processed.effects];
  let newPendingArmor = processed.pendingArmorReduction;
  let newDudArmor = trainer.routeProgress.dudArmorReduction + processed.dudArmorReduction;

  let newTotalCost = trainer.routeProgress.totalCost + effectiveCost;
  if (reduceCostAllWashAll) {
    newTotalCost = 0;
  } else if (reduceCostAllAmount > 0) {
    newTotalCost = Math.max(0, newTotalCost - reduceCostAllAmount);
  }

  let progress: RouteProgress = {
    totalDistance: trainer.routeProgress.totalDistance + pokemon.distance + bonusDistance,
    totalCost: newTotalCost,
    pokemonDrawn: trainer.routeProgress.pokemonDrawn + 1,
    activeEffects: allEffects.length > 0
      ? [...trainer.routeProgress.activeEffects, ...allEffects]
      : trainer.routeProgress.activeEffects,
    pendingArmorReduction: newPendingArmor,
    dudArmorReduction: newDudArmor,
  };

  let newThreshold = trainer.bustThreshold + thresholdMod;
  let busted = progress.totalCost > newThreshold;

  const events: GameEvent[] = [
    ...echoEvents,
    { type: "pokemon_drawn", trainerId: trainer.id, pokemon, progress },
  ];

  for (const effect of allEffects) {
    events.push({
      type: "ability_triggered",
      pokemonId: pokemon.id,
      effect,
      description: pokemon.description,
    });
  }

  let totalCardsDrawn = 1;

  // Fury draw loop
  const FURY_DEPTH_LIMIT = 5;
  let furyDepth = 0;
  while (!busted && allEffects.some(e => e.type === "fury_draw") && furyDepth < FURY_DEPTH_LIMIT) {
    furyDepth++;
    const furyResult = drawPokemon(currentDeck);
    if (!furyResult) break;
    const [furyDeck, furyPokemon] = furyResult;
    currentDeck = furyDeck;

    events.push({ type: "fury_draw", trainerId: trainer.id, pokemon: furyPokemon });

    const furyProcessed = processDrawnPokemon(
      furyPokemon, currentDeck.drawn, progress, newThreshold, routeModifiers,
    );

    let furyCost = furyProcessed.effectiveCost;
    let furyBonusDist = furyProcessed.bonusDistance;
    let furyThreshMod = furyProcessed.thresholdMod;
    let furyReduceAll = furyProcessed.reduceCostAllAmount;
    let furyWashAll = furyProcessed.reduceCostAllWashAll;

    let furyTotalCost = progress.totalCost + furyCost;
    if (furyWashAll) {
      furyTotalCost = 0;
    } else if (furyReduceAll > 0) {
      furyTotalCost = Math.max(0, furyTotalCost - furyReduceAll);
    }

    newThreshold += furyThreshMod;
    newPendingArmor = furyProcessed.pendingArmorReduction;
    newDudArmor = progress.dudArmorReduction + furyProcessed.dudArmorReduction;

    progress = {
      totalDistance: progress.totalDistance + furyPokemon.distance + furyBonusDist,
      totalCost: furyTotalCost,
      pokemonDrawn: progress.pokemonDrawn + 1,
      activeEffects: furyProcessed.effects.length > 0
        ? [...progress.activeEffects, ...furyProcessed.effects]
        : progress.activeEffects,
      pendingArmorReduction: newPendingArmor,
      dudArmorReduction: newDudArmor,
    };

    events.push({ type: "pokemon_drawn", trainerId: trainer.id, pokemon: furyPokemon, progress });

    for (const effect of furyProcessed.effects) {
      events.push({
        type: "ability_triggered",
        pokemonId: furyPokemon.id,
        effect,
        description: furyPokemon.description,
      });
    }

    busted = progress.totalCost > newThreshold;
    allEffects = furyProcessed.effects;
    totalCardsDrawn++;
  }

  // Check for on_bust moves across all drawn pokemon
  let hexNegateUsed = false;
  if (busted) {
    for (const drawn of currentDeck.drawn) {
      const bustEffects = resolveMoves(drawn, "on_bust", currentDeck.drawn, progress, newThreshold);
      // negate_bust always works; hex_negate only works if not already used this game
      const negation = bustEffects.find(e =>
        e.type === "negate_bust" ||
        (e.type === "hex_negate" && !trainer.usedHexNegate && !hexNegateUsed)
      );
      if (negation) {
        busted = false;
        if (negation.type === "hex_negate") {
          hexNegateUsed = true;
        }
        // Clamp cost to threshold so the negation doesn't grant permanent immunity
        progress = { ...progress, totalCost: newThreshold };
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

  // Check for item pickup
  let collectedItems = [...trainer.items];
  if (state.currentRoute!.trail) {
    const trailPos = getTrailPosition(state.currentRoute!.trail, progress.totalDistance);
    const spot = state.currentRoute!.trail.spots[trailPos];
    if (spot.item) {
      collectedItems.push(spot.item.id);
      events.push({
        type: "item_collected",
        trainerId: trainer.id,
        item: spot.item,
        spotIndex: spot.index,
      });
    }
  }

  // Collect peek effects and emit peek_result
  const peekCount = progress.activeEffects
    .filter(e => e.type === "peek_deck")
    .reduce((max, e) => Math.max(max, (e as { type: "peek_deck"; count: number }).count), 0);
  if (peekCount > 0 && !busted) {
    const peeked = currentDeck.drawPile.slice(0, peekCount);
    if (peeked.length > 0) {
      events.push({ type: "peek_result", trainerId: trainer.id, cards: [...peeked] });
    }
  }

  const updatedTrainer: Trainer = {
    ...trainer,
    deck: currentDeck,
    routeProgress: progress,
    bustThreshold: newThreshold,
    items: collectedItems,
    status: busted ? "busted" : "exploring",
    echoes: updatedEchoes,
    usedHexNegate: hexNegateUsed ? true : trainer.usedHexNegate,
    stats: {
      ...trainer.stats,
      cardsDrawn: trainer.stats.cardsDrawn + totalCardsDrawn,
      maxCardDistance: Math.max(trainer.stats.maxCardDistance, pokemon.distance + processed.bonusDistance),
    },
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

function handleContinueEvent(state: GameState): ResolveResult {
  if (state.phase !== "event") return [state, []];

  let currentRoute = state.currentRoute;
  if (state.event && state.event.type === "modifier" && currentRoute) {
    currentRoute = {
      ...currentRoute,
      modifiers: [...currentRoute.modifiers, state.event.modifier],
    };
  }

  return [{ ...state, phase: "route", currentRoute, event: null }, []];
}

/** Compute end-of-round rewards: trail position VP/currency + end_of_round ability effects + broadcasts + echoes. */
function resolveRouteEnd(trainer: Trainer, trail: Trail, event: RouteEvent | null): {
  vpEarned: number;
  currencyEarned: number;
  events: GameEvent[];
  broadcasts: ActiveBroadcast[];
  echoes: EchoEntry[];
} {
  const trailPos = getTrailPosition(trail, trainer.routeProgress.totalDistance);
  const vpEarned = trail.spots[trailPos].vp;

  let bonusCurrency = 0;
  const events: GameEvent[] = [];
  const broadcasts: ActiveBroadcast[] = [];
  const echoes: EchoEntry[] = [];

  for (const drawn of trainer.deck.drawn) {
    const effects = resolveMoves(drawn, "end_of_round", trainer.deck.drawn, trainer.routeProgress, trainer.bustThreshold);
    for (const effect of effects) {
      if (effect.type === "bonus_currency") {
        bonusCurrency += effect.amount;
      }
      if (effect.type === "broadcast") {
        broadcasts.push({
          ownerId: trainer.id,
          pokemonName: drawn.name,
          broadcastId: effect.broadcastId,
          allAmount: effect.allAmount,
          ownerAmount: effect.ownerAmount,
          stat: effect.stat,
          category: effect.category,
        });
      }
      events.push({
        type: "ability_triggered",
        pokemonId: drawn.id,
        effect,
        description: drawn.description,
      });
    }

    // Collect echoes from on_draw triggered moves
    const drawEffects = resolveMoves(drawn, "on_draw", trainer.deck.drawn, trainer.routeProgress, trainer.bustThreshold);
    for (const effect of drawEffects) {
      if (effect.type === "echo") {
        echoes.push({ pokemonId: drawn.id, effect: effect.echoEffect });
      }
    }
  }

  let currencyEarned = trail.spots[trailPos].currency + bonusCurrency;
  if (event?.type === "bounty") {
    currencyEarned *= 2;
  }
  return { vpEarned, currencyEarned, events, broadcasts, echoes };
}

function handleStop(
  state: GameState,
  action: { type: "stop"; trainerId: string }
): ResolveResult {
  if (state.phase !== "route") return [state, []];
  const trainer = state.trainers[action.trainerId];
  if (!trainer || trainer.status !== "exploring") return [state, []];

  const { vpEarned, currencyEarned, events, broadcasts, echoes } = resolveRouteEnd(trainer, state.currentRoute!.trail, state.event);

  events.push(
    { type: "trainer_stopped", trainerId: trainer.id, totalDistance: trainer.routeProgress.totalDistance, vpEarned },
  );

  const finalDistance = trainer.routeProgress.totalDistance;
  const finalCost = trainer.routeProgress.totalCost;

  const updatedTrainer: Trainer = {
    ...trainer,
    score: trainer.score + vpEarned,
    currency: trainer.currency + currencyEarned,
    status: "stopped",
    deck: endTurn(trainer.deck),
    routeProgress: freshProgress(),
    finalRouteDistance: finalDistance,
    finalRouteCost: finalCost,
    echoes: [...trainer.echoes, ...echoes],
    stats: {
      ...trainer.stats,
      maxRouteDistance: Math.max(trainer.stats.maxRouteDistance, finalDistance),
      totalCurrencyEarned: trainer.stats.totalCurrencyEarned + currencyEarned,
    },
  };

  let newState: GameState = {
    ...state,
    trainers: { ...state.trainers, [trainer.id]: updatedTrainer },
    activeBroadcasts: [...state.activeBroadcasts, ...broadcasts],
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

  const { vpEarned, currencyEarned, events, broadcasts, echoes } = resolveRouteEnd(trainer, state.currentRoute!.trail, state.event);

  const finalDistance = trainer.routeProgress.totalDistance;
  const finalCost = trainer.routeProgress.totalCost;

  const updatedTrainer: Trainer = {
    ...trainer,
    score: action.choice === "keep_score" ? trainer.score + vpEarned : trainer.score,
    currency: action.choice === "keep_currency" ? trainer.currency + currencyEarned : trainer.currency,
    status: "stopped",
    deck: endTurn(trainer.deck),
    routeProgress: freshProgress(),
    finalRouteDistance: finalDistance,
    finalRouteCost: finalCost,
    echoes: [...trainer.echoes, ...echoes],
    stats: {
      ...trainer.stats,
      bustCount: trainer.stats.bustCount + 1,
      maxRouteDistance: Math.max(trainer.stats.maxRouteDistance, finalDistance),
      totalCurrencyEarned: trainer.stats.totalCurrencyEarned + (action.choice === "keep_currency" ? currencyEarned : 0),
    },
  };

  events.push(
    { type: "bust_penalty_chosen", trainerId: trainer.id, choice: action.choice },
  );

  let newState: GameState = {
    ...state,
    trainers: { ...state.trainers, [trainer.id]: updatedTrainer },
    activeBroadcasts: [...state.activeBroadcasts, ...broadcasts],
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
  const results: Record<string, { distance: number; vp: number; currencyEarned: number; busted: boolean }> = {};
  for (const t of Object.values(state.trainers)) {
    results[t.id] = { distance: t.score, vp: t.score, currencyEarned: t.currency, busted: bustedTrainerIds.includes(t.id) };
  }

  // Collapse and apply broadcasts
  const allBroadcasts = state.activeBroadcasts;
  const collapsed = collapseBroadcasts(allBroadcasts);
  const playerIds = Object.keys(state.trainers);
  const broadcastModifiers = applyBroadcasts(collapsed, playerIds);

  // Reset trainers to waiting, apply broadcast modifiers
  const trainers: Record<string, Trainer> = {};
  for (const [id, t] of Object.entries(state.trainers)) {
    const mods = broadcastModifiers[id];
    trainers[id] = {
      ...t,
      status: "waiting",
      routeProgress: freshProgress(),
      currency: t.currency + mods.currency,
      pendingThresholdBonus: t.pendingThresholdBonus + mods.threshold,
    };
  }

  if (collapsed.length > 0) {
    events.push({ type: "broadcast_resolved", broadcasts: collapsed });
  }

  events.push({ type: "route_completed", results });

  // Check if this was the champion route → game over
  if (state.map) {
    const currentNode = state.map.nodes[state.map.currentNodeId];
    if (currentNode.type === "champion") {
      // Compute final deck sizes
      for (const [id, t] of Object.entries(trainers)) {
        const deckSize = t.deck.drawPile.length + t.deck.drawn.length + t.deck.discard.length;
        trainers[id] = { ...t, stats: { ...t.stats, finalDeckSize: deckSize } };
      }

      const allStats: Record<string, TrainerStats> = {};
      for (const [id, t] of Object.entries(trainers)) {
        allStats[id] = t.stats;
      }
      const superlatives = calculateSuperlatives(allStats);

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
        superlatives,
        activeBroadcasts: collapsed,
      };
    }
  }

  // Evolve each trainer's deck before entering hub
  const currentTier = state.map!.nodes[state.map!.currentNodeId].tier;
  for (const [id, t] of Object.entries(trainers)) {
    const [evolvedDeck, newDraftedAtTier, evoEvents] = evolveDeck(t.deck, t.draftedAtTier, currentTier);
    trainers[id] = { ...t, deck: evolvedDeck, draftedAtTier: newDraftedAtTier };
    for (const evo of evoEvents) {
      events.push({ type: "pokemon_evolved", ...evo });
    }
  }

  // Enter hub phase instead of world
  const hubState: GameState = {
    ...state,
    trainers,
    currentRoute: { ...state.currentRoute, status: "complete" },
    activeBroadcasts: collapsed,
  };
  const [finalState, hubEvents] = enterHub(hubState, bustedTrainerIds, Math.random);
  events.push(...hubEvents);
  return finalState;
}

function handlePlayAgain(state: GameState): ResolveResult {
  if (state.phase !== "game_over") return [state, []];

  const trainers: Record<string, Trainer> = {};
  for (const [id, t] of Object.entries(state.trainers)) {
    trainers[id] = {
      ...t,
      deck: createDeck(createStarterTeam()),
      score: 0,
      bustThreshold: 0,
      currency: 0,
      items: [],
      status: "waiting",
      routeProgress: freshProgress(),
      finalRouteDistance: null,
      finalRouteCost: null,
      stats: freshStats(),
      pendingThresholdBonus: 0,
      echoes: [],
      draftedAtTier: {},
      usedHexNegate: false,
    };
  }

  return [{
    ...state,
    phase: "lobby",
    trainers,
    map: null,
    currentRoute: null,
    hub: null,
    votes: null,
    routeNumber: 0,
    superlatives: [],
    event: null,
    restStopChoices: null,
    activeBroadcasts: [],
  }, [{ type: "play_again" as const }]];
}
