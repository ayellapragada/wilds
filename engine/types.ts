import type { AbilityData, AbilityEffect } from "./abilities/types";

// === Creatures ===

export type CreatureType = "fire" | "water" | "earth" | "air" | "shadow" | "light";
export type Rarity = "common" | "uncommon" | "rare" | "legendary";

export interface Creature {
  readonly id: string;
  readonly templateId: string;
  readonly name: string;
  readonly type: CreatureType;
  readonly distance: number;
  readonly cost: number;
  readonly ability: AbilityData | null;
  readonly rarity: Rarity;
  readonly description: string;
}

// === Deck (your team) ===

export interface Deck {
  readonly drawPile: readonly Creature[];
  readonly drawn: readonly Creature[];
  readonly discard: readonly Creature[];
}

// === Trainer ===

export type TrainerStatus = "waiting" | "exploring" | "busted" | "stopped";

export interface RouteProgress {
  readonly totalDistance: number;
  readonly totalCost: number;
  readonly creaturesDrawn: number;
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
  readonly targetType?: CreatureType;
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
  readonly creaturePool: readonly string[];
}

export interface WorldMap {
  readonly nodes: Record<string, RouteNode>;
  readonly currentNodeId: string;
  readonly totalTiers: number;
}

// === Hub ===

export interface HubState {
  readonly phase: "free_pick" | "marketplace";
  readonly freePickOffers: Record<string, readonly Creature[]>;
  readonly freePicksMade: Record<string, string | null>;
  readonly shopCreatures: readonly Creature[];
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
  | { type: "buy_creature"; trainerId: string; creatureId: string }
  | { type: "sell_creature"; trainerId: string; creatureId: string }
  | { type: "choose_rest_benefit"; trainerId: string; benefit: "threshold" | "remove_creature" | "preview" }
  | { type: "ready_up"; trainerId: string }
  | { type: "pick_free_creature"; trainerId: string; creatureId: string }
  | { type: "skip_free_pick"; trainerId: string };

// === Events ===

export type GameEvent =
  | { type: "trainer_joined"; trainerId: string; trainerName: string }
  | { type: "game_started"; map: WorldMap }
  | { type: "route_started"; routeNumber: number; routeName: string; turnOrder: string[]; modifiers: RouteModifier[] }
  | { type: "turn_started"; trainerId: string }
  | { type: "creature_drawn"; trainerId: string; creature: Creature; progress: RouteProgress }
  | { type: "ability_triggered"; creatureId: string; effect: AbilityEffect; description: string }
  | { type: "trainer_busted"; trainerId: string; totalDistance: number; totalCost: number }
  | { type: "trainer_stopped"; trainerId: string; totalDistance: number }
  | { type: "bust_penalty_chosen"; trainerId: string; choice: "keep_score" | "keep_currency" }
  | { type: "route_completed"; results: Record<string, RouteResult> }
  | { type: "world_entered" }
  | { type: "vote_cast"; trainerId: string; nodeId: string }
  | { type: "route_chosen"; nodeId: string; votes: Record<string, number> }
  | { type: "marketplace_opened"; availableCreatures: Creature[]; prices: Record<string, number> }
  | { type: "creature_purchased"; trainerId: string; creature: Creature }
  | { type: "creature_sold"; trainerId: string; creatureId: string }
  | { type: "rest_benefit_chosen"; trainerId: string; benefit: string }
  | { type: "hub_entered"; freePickOffers: Record<string, readonly Creature[]>; shopCreatures: Creature[]; shopPrices: Record<string, number> }
  | { type: "free_creature_picked"; trainerId: string; creature: Creature }
  | { type: "free_pick_skipped"; trainerId: string }
  | { type: "all_ready" }
  | { type: "game_over"; finalScores: Record<string, number>; championId: string };
