import type { Move, AbilityEffect } from "./abilities/types";

// === Utilities ===

export type RngFn = () => number;

// === Pokemon ===

export type PokemonType =
  | "normal" | "fire" | "water" | "grass" | "electric" | "ice"
  | "fighting" | "poison" | "ground" | "flying" | "psychic" | "bug"
  | "rock" | "ghost" | "dragon" | "dark" | "steel" | "fairy";
export type Rarity = "common" | "uncommon" | "rare" | "legendary";
export type EvolutionStage = "basic" | "stage1" | "stage2";

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
  readonly stage: EvolutionStage;
  readonly evolutionLine: string;
  readonly evolvesInto: string | null;
  readonly evolutionSpeed: number | null;
}

export interface EchoEntry {
  readonly pokemonId: string;
  readonly effect: import("./abilities/types").AbilityEffect;
}

export interface ActiveBroadcast {
  readonly ownerId: string;
  readonly pokemonName: string;
  readonly broadcastId: string;
  readonly allAmount: number;
  readonly ownerAmount: number;
  readonly stat: "currency" | "threshold" | "distance" | "cost";
  readonly category: "beneficial" | "taxing";
}

// === Deck (your team) ===

export interface Deck {
  readonly drawPile: readonly Pokemon[];
  readonly drawn: readonly Pokemon[];
  readonly discard: readonly Pokemon[];
}

// === Avatar ===

export type AvatarId = number;

// === Trainer ===

export type TrainerStatus = "waiting" | "exploring" | "busted" | "stopped";

export interface RouteProgress {
  readonly totalDistance: number;
  readonly totalCost: number;
  readonly pokemonDrawn: number;
  readonly activeEffects: readonly AbilityEffect[];
  readonly pendingArmorReduction: number;
  readonly dudArmorReduction: number;
}

export interface TrainerStats {
  readonly cardsDrawn: number;
  readonly bustCount: number;
  readonly maxRouteDistance: number;
  readonly totalCurrencyEarned: number;
  readonly maxCardDistance: number;
  readonly finalDeckSize: number;
}

export interface Trainer {
  readonly id: string;
  readonly sessionToken: string;
  readonly name: string;
  readonly avatar: AvatarId;
  readonly deck: Deck;
  readonly score: number;
  readonly bustThreshold: number;
  readonly currency: number;
  readonly items: readonly ItemId[];
  readonly status: TrainerStatus;
  readonly routeProgress: RouteProgress;
  readonly finalRouteDistance: number | null;
  readonly finalRouteCost: number | null;
  readonly bot: boolean;
  readonly stats: TrainerStats;
  readonly pendingThresholdBonus: number;
  readonly echoes: readonly EchoEntry[];
  readonly draftedAtTier: Record<string, number>;
  readonly usedHexNegate: boolean;
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

export type RouteEvent =
  | { type: "modifier"; modifier: RouteModifier; name: string; description: string }
  | { type: "fog"; name: string; description: string }
  | { type: "bounty"; name: string; description: string };

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
  readonly isMarketplace: boolean;
}

// === Game State ===

export type GamePhase = "lobby" | "event" | "route" | "hub" | "rest_stop" | "world" | "game_over";

export interface Superlative {
  readonly trainerId: string;
  readonly award: string;
}

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
  readonly botStrategies: Record<string, string>;
  readonly superlatives: readonly Superlative[];
  readonly event: RouteEvent | null;
  readonly restStopChoices: Record<string, string> | null;
  readonly activeBroadcasts: readonly ActiveBroadcast[];
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
  | { type: "confirm_selections"; trainerId: string }
  | { type: "add_bot"; strategy: "aggressive" | "conservative" | "random" }
  | { type: "remove_bot"; trainerId: string }
  | { type: "select_avatar"; trainerId: string; avatar: AvatarId }
  | { type: "play_again"; trainerId: string }
  | { type: "continue_event"; trainerId: string }
  | { type: "rest_stop_choice"; trainerId: string; choice: "remove" | "scout" | "reinforce"; pokemonId?: string };

// === Events ===

export type GameEvent =
  | { type: "trainer_joined"; trainerId: string; trainerName: string }
  | { type: "trainer_left"; trainerId: string }
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
  | { type: "game_over"; finalScores: Record<string, number>; championId: string }
  | { type: "play_again" }
  | { type: "event_started"; event: RouteEvent }
  | { type: "rest_stop_entered" }
  | { type: "rest_stop_choice_made"; trainerId: string; choice: string }
  | { type: "scout_result"; trainerId: string; pokemonIds: string[] }
  | { type: "fury_draw"; trainerId: string; pokemon: Pokemon }
  | { type: "pokemon_evolved"; pokemonId: string; fromTemplateId: string; toTemplateId: string; fromName: string; toName: string }
  | { type: "echo_triggered"; trainerId: string; pokemonId: string; effect: AbilityEffect }
  | { type: "broadcast_resolved"; broadcasts: readonly ActiveBroadcast[] }
  | { type: "armor_applied"; trainerId: string; reduction: number; target: string }
  | { type: "peek_result"; trainerId: string; cards: Pokemon[] };

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
  readonly avatar: AvatarId;
  readonly score: number;
  readonly currency: number;
  readonly status: TrainerStatus;
  readonly bustThreshold: number;
  readonly routeProgress: RouteProgress;
  readonly finalRouteDistance: number | null;
  readonly finalRouteCost: number | null;
  readonly deckSize: number;
  readonly bot: boolean;
  readonly riskLevel: "safe" | "risky" | "danger";
  readonly stats?: TrainerStats;
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
  readonly superlatives: readonly Superlative[];
  readonly event: RouteEvent | null;
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
  readonly settings: GameSettings;
  readonly superlatives: readonly Superlative[];
  readonly event: RouteEvent | null;
}

// === Resolve Result ===

export type ResolveResult = [GameState, GameEvent[]];
