import type { Move, AbilityEffect } from "./abilities/types";

// === Pokemon ===

export type PokemonType =
  | "normal" | "fire" | "water" | "grass" | "electric" | "ice"
  | "fighting" | "poison" | "ground" | "flying" | "psychic" | "bug"
  | "rock" | "ghost" | "dragon" | "dark" | "steel" | "fairy";
export type Rarity = "common" | "uncommon" | "rare" | "legendary";

export type ItemId = "nugget";

export interface ItemTemplate {
  readonly id: ItemId;
  readonly name: string;
  readonly description: string;
  readonly hidden: boolean;
}

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
  readonly currency: number;
  readonly items: readonly ItemId[];
  readonly status: TrainerStatus;
  readonly routeProgress: RouteProgress;
}

// === Trail ===

export interface TrailSpot {
  readonly index: number;
  readonly vp: number;
  readonly currency: number;
  readonly distanceCost: number;
  readonly item: ItemTemplate | null;
}

export interface Trail {
  readonly spots: readonly TrailSpot[];
}

export type CurrencyCurve = "flat" | "linear" | "accelerating" | "front_loaded";

export interface CurrencyDistribution {
  readonly total: number;
  readonly curve: CurrencyCurve;
}

// === Route (a single push-your-luck round) ===

export interface RouteResult {
  readonly distance: number;
  readonly vp: number;
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
  readonly bustThreshold: number;
  readonly modifiers: readonly RouteModifier[];
  readonly trail: Trail;
}

export interface RouteModifier {
  readonly id: string;
  readonly description: string;
  readonly type: "distance_bonus" | "cost_bonus" | "threshold_modifier" | "type_bonus";
  readonly value: number;
  readonly targetType?: PokemonType;
}

// === World Map ===

export type RouteNodeType = "beginner" | "route" | "elite_route" | "champion";
export type BonusType = "marketplace" | "rest_stop" | "event";

export interface RouteNode {
  readonly id: string;
  readonly type: RouteNodeType;
  readonly bonus: BonusType | null;
  readonly name: string;
  readonly tier: number;
  readonly connections: readonly string[];
  readonly bustThreshold: number;
  readonly modifiers: readonly RouteModifier[];
  readonly currencyDistribution: CurrencyDistribution;
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
  readonly freePickOffers: Record<string, readonly Pokemon[]>;
  readonly shopPokemon: readonly Pokemon[];
  readonly shopPrices: Record<string, number>;
  readonly selections: Record<string, readonly string[]>;
  readonly confirmedTrainers: readonly string[];
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
  | { type: "select_pokemon"; trainerId: string; pokemonId: string }
  | { type: "confirm_selections"; trainerId: string };

// === Events ===

export type GameEvent =
  | { type: "trainer_joined"; trainerId: string; trainerName: string }
  | { type: "game_started"; map: WorldMap }
  | { type: "route_started"; routeNumber: number; routeName: string; turnOrder: string[]; modifiers: RouteModifier[] }
  | { type: "turn_started"; trainerId: string }
  | { type: "pokemon_drawn"; trainerId: string; pokemon: Pokemon; progress: RouteProgress }
  | { type: "ability_triggered"; pokemonId: string; effect: AbilityEffect; description: string }
  | { type: "trainer_busted"; trainerId: string; totalDistance: number; totalCost: number }
  | { type: "trainer_stopped"; trainerId: string; totalDistance: number; vpEarned: number }
  | { type: "bust_penalty_chosen"; trainerId: string; choice: "keep_score" | "keep_currency" }
  | { type: "route_completed"; results: Record<string, RouteResult> }
  | { type: "world_entered" }
  | { type: "vote_cast"; trainerId: string; nodeId: string }
  | { type: "route_chosen"; nodeId: string; votes: Record<string, number> }
  | { type: "hub_entered"; freePickOffers: Record<string, readonly Pokemon[]>; shopPokemon: Pokemon[]; shopPrices: Record<string, number> }
  | { type: "pokemon_selected"; trainerId: string; pokemonId: string }
  | { type: "pokemon_deselected"; trainerId: string; pokemonId: string }
  | { type: "selections_confirmed"; trainerId: string; pokemon: Pokemon[] }
  | { type: "all_ready" }
  | { type: "item_collected"; trainerId: string; item: ItemTemplate; spotIndex: number }
  | { type: "game_over"; finalScores: Record<string, number>; championId: string };

// === Connection ===

export type ConnectionRole = "tv" | "phone";

export interface ConnectionInfo {
  readonly role: ConnectionRole;
  readonly trainerId: string | null;
}

// === Views (server sends these, not raw GameState) ===

export interface TrainerPublicInfo {
  readonly id: string;
  readonly name: string;
  readonly score: number;
  readonly currency: number;
  readonly status: TrainerStatus;
  readonly bustThreshold: number;
  readonly routeProgress: RouteProgress;
  readonly deckSize: number;
}

export interface TVViewState {
  readonly type: "tv";
  readonly roomCode: string;
  readonly phase: GamePhase;
  readonly trainers: Record<string, TrainerPublicInfo>;
  readonly map: WorldMap | null;
  readonly currentRoute: Route | null;
  readonly hub: HubState | null;
  readonly votes: Record<string, string> | null;
  readonly routeNumber: number;
  readonly settings: GameSettings;
}

export interface PhoneViewState {
  readonly type: "phone";
  readonly roomCode: string;
  readonly phase: GamePhase;
  readonly me: Trainer;
  readonly otherTrainers: Record<string, TrainerPublicInfo>;
  readonly currentRoute: Route | null;
  readonly hub: HubState | null;
  readonly votes: Record<string, string> | null;
  readonly routeNumber: number;
  readonly map: WorldMap | null;
}
