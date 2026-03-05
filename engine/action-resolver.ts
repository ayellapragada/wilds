import type { GameState, Action, GameEvent, Player, TurnState, Round } from "./types";
import { createStarterDeck } from "./cards/catalog";
import { createDeck, drawCard, endTurn } from "./models/deck";

export type ResolveResult = [GameState, GameEvent[]];

export function resolveAction(state: GameState, action: Action): ResolveResult {
  switch (action.type) {
    case "join_game":
      return handleJoin(state, action);
    case "start_game":
      return handleStart(state, action);
    case "draw_card":
      return handleDraw(state, action);
    case "stop_turn":
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
  action: { type: "join_game"; playerName: string; sessionToken: string }
): ResolveResult {
  if (state.phase !== "lobby") return [state, []];
  if (Object.keys(state.players).length >= state.settings.maxPlayers) return [state, []];
  // Ignore if already joined
  if (state.players[action.sessionToken]) return [state, []];

  const playerId = action.sessionToken;

  const player: Player = {
    id: playerId,
    sessionToken: action.sessionToken,
    name: action.playerName,
    deck: createDeck(createStarterDeck()),
    score: 0,
    bustThreshold: 10,
    baseBustThreshold: 10,
    currency: 0,
    status: "waiting",
    turnState: freshTurnState(),
  };

  return [
    { ...state, players: { ...state.players, [playerId]: player } },
    [{ type: "player_joined", playerId, playerName: action.playerName }],
  ];
}

function handleStart(
  state: GameState,
  _action: { type: "start_game"; playerId: string }
): ResolveResult {
  if (state.phase !== "lobby") return [state, []];
  const playerIds = Object.keys(state.players);
  if (playerIds.length === 0) return [state, []];

  // Set all players to active
  const players: Record<string, Player> = {};
  for (const [id, p] of Object.entries(state.players)) {
    players[id] = { ...p, status: "active", turnState: freshTurnState() };
  }

  const round: Round = {
    roundNumber: 1,
    turnOrder: playerIds,
    currentTurnIndex: 0,
    playerResults: {},
    status: "in_progress",
    encounterModifiers: [],
  };

  return [
    { ...state, phase: "encounter", players, currentRound: round, roundNumber: 1 },
    [{ type: "round_started", roundNumber: 1, turnOrder: [...playerIds] }],
  ];
}

// === Encounter ===

function handleDraw(
  state: GameState,
  action: { type: "draw_card"; playerId: string }
): ResolveResult {
  if (state.phase !== "encounter") return [state, []];
  const player = state.players[action.playerId];
  if (!player || player.status !== "active") return [state, []];

  const result = drawCard(player.deck);
  if (!result) return [state, []];
  const [newDeck, card] = result;

  const turnState: TurnState = {
    ...player.turnState,
    totalDistance: player.turnState.totalDistance + card.distance,
    totalCost: player.turnState.totalCost + card.cost,
    cardsDrawn: player.turnState.cardsDrawn + 1,
    activeEffects: [],
    canAct: true,
  };

  const busted = turnState.totalCost > player.bustThreshold;
  const events: GameEvent[] = [
    { type: "card_drawn", playerId: player.id, card, turnState },
  ];

  const updatedPlayer: Player = {
    ...player,
    deck: newDeck,
    turnState,
    status: busted ? "busted" : "active",
  };

  if (busted) {
    events.push({
      type: "player_busted",
      playerId: player.id,
      totalDistance: turnState.totalDistance,
      totalCost: turnState.totalCost,
    });
  }

  let newState: GameState = {
    ...state,
    players: { ...state.players, [player.id]: updatedPlayer },
  };

  // If busted, wait for bust penalty choice — don't auto-advance
  return [newState, events];
}

function handleStop(
  state: GameState,
  action: { type: "stop_turn"; playerId: string }
): ResolveResult {
  if (state.phase !== "encounter") return [state, []];
  const player = state.players[action.playerId];
  if (!player || player.status !== "active") return [state, []];

  const distanceEarned = player.turnState.totalDistance;
  const currencyEarned = Math.floor(distanceEarned / 3);

  const events: GameEvent[] = [
    { type: "player_stopped", playerId: player.id, totalDistance: distanceEarned },
  ];

  const updatedPlayer: Player = {
    ...player,
    score: player.score + distanceEarned,
    currency: player.currency + currencyEarned,
    status: "stopped",
    deck: endTurn(player.deck),
    turnState: freshTurnState(),
  };

  let newState: GameState = {
    ...state,
    players: { ...state.players, [player.id]: updatedPlayer },
  };

  newState = maybeEndRound(newState, events);
  return [newState, events];
}

function handleBustPenalty(
  state: GameState,
  action: { type: "choose_bust_penalty"; playerId: string; choice: "keep_score" | "keep_currency" }
): ResolveResult {
  if (state.phase !== "encounter") return [state, []];
  const player = state.players[action.playerId];
  if (!player || player.status !== "busted") return [state, []];

  const distance = player.turnState.totalDistance;
  const currency = Math.floor(distance / 3);

  const updatedPlayer: Player = {
    ...player,
    score: action.choice === "keep_score" ? player.score + distance : player.score,
    currency: action.choice === "keep_currency" ? player.currency + currency : player.currency,
    status: "stopped",
    deck: endTurn(player.deck),
    turnState: freshTurnState(),
  };

  const events: GameEvent[] = [
    { type: "bust_penalty_chosen", playerId: player.id, choice: action.choice },
  ];

  let newState: GameState = {
    ...state,
    players: { ...state.players, [player.id]: updatedPlayer },
  };

  newState = maybeEndRound(newState, events);
  return [newState, events];
}

// === Helpers ===

function freshTurnState(): TurnState {
  return {
    totalDistance: 0,
    totalCost: 0,
    cardsDrawn: 0,
    activeEffects: [],
    canAct: true,
  };
}

function maybeEndRound(state: GameState, events: GameEvent[]): GameState {
  const allDone = Object.values(state.players).every(
    p => p.status === "stopped" || p.status === "waiting"
  );

  if (!allDone || !state.currentRound) return state;

  // Build round results
  const results: Record<string, { distance: number; currencyEarned: number; busted: boolean }> = {};
  for (const p of Object.values(state.players)) {
    results[p.id] = { distance: p.score, currencyEarned: p.currency, busted: false };
  }

  events.push({ type: "round_ended", results });

  // For now, go back to lobby so we can play again (no map/voting yet)
  // Reset all players to active for another round
  const players: Record<string, Player> = {};
  for (const [id, p] of Object.entries(state.players)) {
    players[id] = { ...p, status: "active", turnState: freshTurnState() };
  }

  const round: Round = {
    roundNumber: state.roundNumber + 1,
    turnOrder: Object.keys(state.players),
    currentTurnIndex: 0,
    playerResults: results,
    status: "in_progress",
    encounterModifiers: [],
  };

  return {
    ...state,
    players,
    currentRound: round,
    roundNumber: state.roundNumber + 1,
  };
}
