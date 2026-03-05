// === Card Types ===

export type CreatureType = "fire" | "water" | "earth" | "air" | "shadow" | "light";
export type Rarity = "common" | "uncommon" | "rare" | "legendary";

export interface Card {
  readonly id: string;
  readonly templateId: string;
  readonly name: string;
  readonly type: CreatureType;
  readonly distance: number;
  readonly cost: number;
  readonly abilityId: string | null;
  readonly rarity: Rarity;
  readonly description: string;
}

// === Deck ===

export interface Deck {
  readonly drawPile: readonly Card[];
  readonly drawn: readonly Card[];
  readonly discard: readonly Card[];
}

// === Player ===

export interface TurnState {
  readonly totalDistance: number;
  readonly totalCost: number;
  readonly cardsDrawn: number;
  readonly activeEffects: readonly AbilityEffect[];
  readonly canAct: boolean;
}

export type PlayerStatus = "waiting" | "active" | "busted" | "stopped";

export interface Player {
  readonly id: string;
  readonly sessionToken: string;
  readonly name: string;
  readonly deck: Deck;
  readonly score: number;
  readonly bustThreshold: number;
  readonly baseBustThreshold: number;
  readonly currency: number;
  readonly status: PlayerStatus;
  readonly turnState: TurnState;
}

// === Map ===

export type NodeType = "encounter" | "elite" | "shop" | "rest" | "event" | "boss";

export interface MapNode {
  readonly id: string;
  readonly type: NodeType;
  readonly tier: number;
  readonly connections: readonly string[];
  readonly modifiers: readonly EncounterModifier[];
  readonly visited: boolean;
}

export interface GameMap {
  readonly nodes: Record<string, MapNode>;
  readonly currentNodeId: string;
  readonly totalTiers: number;
}

// === Round ===

export interface RoundResult {
  readonly distance: number;
  readonly currencyEarned: number;
  readonly busted: boolean;
}

export interface Round {
  readonly roundNumber: number;
  readonly turnOrder: readonly string[];
  readonly currentTurnIndex: number;
  readonly playerResults: Record<string, RoundResult>;
  readonly status: "in_progress" | "complete";
  readonly encounterModifiers: readonly EncounterModifier[];
}

// === Shop ===

export interface Shop {
  readonly availableCards: readonly Card[];
  readonly prices: Record<string, number>;
  readonly playerPurchases: Record<string, readonly string[]>;
}

// === Game State ===

export type GamePhase =
  | "lobby"
  | "encounter"
  | "voting"
  | "shopping"
  | "resting"
  | "event"
  | "game_over";

export interface GameState {
  readonly gameId: string;
  readonly roomCode: string;
  readonly phase: GamePhase;
  readonly players: Record<string, Player>;
  readonly map: GameMap | null;
  readonly currentRound: Round | null;
  readonly shop: Shop | null;
  readonly votes: Record<string, string> | null;
  readonly roundNumber: number;
  readonly settings: GameSettings;
}

export interface GameSettings {
  readonly maxPlayers: number;
  readonly mapTiers: number;
  readonly difficulty: "easy" | "normal" | "hard";
  readonly turnMode: "sequential" | "simultaneous";
}

// === Encounter Modifiers ===

export interface EncounterModifier {
  readonly id: string;
  readonly description: string;
  readonly type: "distance_bonus" | "cost_bonus" | "threshold_modifier" | "type_bonus";
  readonly value: number;
  readonly targetType?: CreatureType;
}

// === Ability Effects ===

export interface AbilityEffect {
  readonly sourceCardId: string;
  readonly distanceBonus?: number;
  readonly costReduction?: number;
  readonly thresholdModifier?: number;
  readonly distanceMultiplier?: { type: CreatureType; multiplier: number };
}

// === Actions ===

export type Action =
  | { type: "join_game"; playerName: string; sessionToken: string }
  | { type: "start_game"; playerId: string }
  | { type: "draw_card"; playerId: string }
  | { type: "stop_turn"; playerId: string }
  | { type: "choose_bust_penalty"; playerId: string; choice: "keep_score" | "keep_currency" }
  | { type: "cast_vote"; playerId: string; nodeId: string }
  | { type: "buy_card"; playerId: string; cardId: string }
  | { type: "sell_card"; playerId: string; cardId: string }
  | { type: "choose_rest_benefit"; playerId: string; benefit: "threshold" | "remove_card" | "preview" }
  | { type: "ready_up"; playerId: string };

// === Events ===

export type GameEvent =
  | { type: "player_joined"; playerId: string; playerName: string }
  | { type: "game_started"; map: GameMap }
  | { type: "round_started"; roundNumber: number; turnOrder: string[] }
  | { type: "turn_started"; playerId: string }
  | { type: "card_drawn"; playerId: string; card: Card; turnState: TurnState }
  | { type: "ability_triggered"; cardId: string; effect: AbilityEffect; description: string }
  | { type: "player_busted"; playerId: string; totalDistance: number; totalCost: number }
  | { type: "player_stopped"; playerId: string; totalDistance: number }
  | { type: "bust_penalty_chosen"; playerId: string; choice: "keep_score" | "keep_currency" }
  | { type: "round_ended"; results: Record<string, RoundResult> }
  | { type: "vote_cast"; playerId: string; nodeId: string }
  | { type: "path_chosen"; nodeId: string; votes: Record<string, number> }
  | { type: "shop_opened"; availableCards: Card[]; prices: Record<string, number> }
  | { type: "card_purchased"; playerId: string; card: Card }
  | { type: "card_sold"; playerId: string; cardId: string }
  | { type: "rest_benefit_chosen"; playerId: string; benefit: string }
  | { type: "game_over"; finalScores: Record<string, number>; winnerId: string };
