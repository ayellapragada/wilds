import type { Move, AbilityEffect } from "./abilities/types";

// === Pokemon ===

export type PokemonType =
  | "normal" | "fire" | "water" | "grass" | "electric" | "ice"
  | "fighting" | "poison" | "ground" | "flying" | "psychic" | "bug"
  | "rock" | "ghost" | "dragon" | "dark" | "steel" | "fairy";
export type Rarity = "common" | "uncommon" | "rare" | "legendary";

export interface Pokemon {
  readonly id: string;
  readonly templateId: string;
  readonly name: string;
  readonly types: readonly PokemonType[];
  readonly distance: number;
  readonly cost: number;
  readonly moves: readonly Move[];
  readonly rarity: Rarity;
  readonly description: string;
}

// === Deck (your team) ===

export interface Deck {
  readonly drawPile: readonly Pokemon[];
  readonly drawn: readonly Pokemon[];
  readonly discard: readonly Pokemon[];
}

// === Trainer ===

export type TrainerStatus = "waiting" | "exploring" | "busted" | "stopped";

export interface RouteProgress {
  readonly totalDistance: number;
  readonly totalCost: number;
  readonly pokemonDrawn: number;
  readonly activeEffects: readonly AbilityEffect[];
}

export interface Trainer {
  readonly id: string;
  readonly sessionToken: string;
  readonly name: string;
  readonly deck: Deck;
  readonly score: number;
  readonly bustThreshold: number;
  readonly baseBustThreshold: number;
  readonly currency: number;
  readonly status: TrainerStatus;
  readonly routeProgress: RouteProgress;
}

// === Route (a single push-your-luck round) ===

export interface RouteResult {
  readonly distance: number;
  readonly currencyEarned: number;
  readonly busted: boolean;
}

export interface Route {
  readonly routeNumber: number;
  readonly name: string;
  readonly turnOrder: readonly string[];
  readonly currentTurnIndex: number;
  readonly trainerResults: Record<string, RouteResult>;
  readonly status: "in_progress" | "complete";
  readonly modifiers: readonly RouteModifier[];
}

export interface RouteModifier {
  readonly id: string;
  readonly description: string;
  readonly type: "distance_bonus" | "cost_bonus" | "threshold_modifier" | "type_bonus";
  readonly value: number;
  readonly targetType?: PokemonType;
}

// === World Map ===

export type RouteNodeType = "route" | "elite_route" | "champion";
export type BonusType = "marketplace" | "rest_stop" | "event";

export interface RouteNode {
  readonly id: string;
  readonly type: RouteNodeType;
  readonly bonus: BonusType | null;
  readonly name: string;
  readonly tier: number;
  readonly connections: readonly string[];
  readonly modifiers: readonly RouteModifier[];
  readonly visited: boolean;
  readonly pokemonPool: readonly string[];
}

export interface WorldMap {
  readonly nodes: Record<string, RouteNode>;
  readonly currentNodeId: string;
  readonly totalTiers: number;
}

// === Hub ===

export interface HubState {
  readonly phase: "free_pick" | "marketplace";
  readonly freePickOffers: Record<string, readonly Pokemon[]>;
  readonly freePicksMade: Record<string, string | null>;
  readonly shopPokemon: readonly Pokemon[];
  readonly shopPrices: Record<string, number>;
  readonly readyTrainers: readonly string[];
}

// === Game State ===

export type GamePhase = "lobby" | "route" | "hub" | "world" | "game_over";

export interface GameState {
  readonly gameId: string;
  readonly roomCode: string;
  readonly phase: GamePhase;
  readonly trainers: Record<string, Trainer>;
  readonly map: WorldMap | null;
  readonly currentRoute: Route | null;
  readonly hub: HubState | null;
  readonly votes: Record<string, string> | null;
  readonly routeNumber: number;
  readonly settings: GameSettings;
}

export interface GameSettings {
  readonly maxTrainers: number;
  readonly mapTiers: number;
  readonly difficulty: "easy" | "normal" | "hard";
}

// === Actions ===

export type Action =
  | { type: "join_game"; trainerName: string; sessionToken: string }
  | { type: "start_game"; trainerId: string }
  | { type: "hit"; trainerId: string }
  | { type: "stop"; trainerId: string }
  | { type: "choose_bust_penalty"; trainerId: string; choice: "keep_score" | "keep_currency" }
  | { type: "cast_vote"; trainerId: string; nodeId: string }
  | { type: "buy_pokemon"; trainerId: string; pokemonId: string }
  | { type: "sell_pokemon"; trainerId: string; pokemonId: string }
  | { type: "choose_rest_benefit"; trainerId: string; benefit: "threshold" | "remove_pokemon" | "preview" }
  | { type: "ready_up"; trainerId: string }
  | { type: "pick_free_pokemon"; trainerId: string; pokemonId: string }
  | { type: "skip_free_pick"; trainerId: string };

// === Events ===

export type GameEvent =
  | { type: "trainer_joined"; trainerId: string; trainerName: string }
  | { type: "game_started"; map: WorldMap }
  | { type: "route_started"; routeNumber: number; routeName: string; turnOrder: string[]; modifiers: RouteModifier[] }
  | { type: "turn_started"; trainerId: string }
  | { type: "pokemon_drawn"; trainerId: string; pokemon: Pokemon; progress: RouteProgress }
  | { type: "ability_triggered"; pokemonId: string; effect: AbilityEffect; description: string }
  | { type: "trainer_busted"; trainerId: string; totalDistance: number; totalCost: number }
  | { type: "trainer_stopped"; trainerId: string; totalDistance: number }
  | { type: "bust_penalty_chosen"; trainerId: string; choice: "keep_score" | "keep_currency" }
  | { type: "route_completed"; results: Record<string, RouteResult> }
  | { type: "world_entered" }
  | { type: "vote_cast"; trainerId: string; nodeId: string }
  | { type: "route_chosen"; nodeId: string; votes: Record<string, number> }
  | { type: "marketplace_opened"; availablePokemon: Pokemon[]; prices: Record<string, number> }
  | { type: "pokemon_purchased"; trainerId: string; pokemon: Pokemon }
  | { type: "pokemon_sold"; trainerId: string; pokemonId: string }
  | { type: "rest_benefit_chosen"; trainerId: string; benefit: string }
  | { type: "hub_entered"; freePickOffers: Record<string, readonly Pokemon[]>; shopPokemon: Pokemon[]; shopPrices: Record<string, number> }
  | { type: "free_pokemon_picked"; trainerId: string; pokemon: Pokemon }
  | { type: "free_pick_skipped"; trainerId: string }
  | { type: "all_ready" }
  | { type: "game_over"; finalScores: Record<string, number>; championId: string };
