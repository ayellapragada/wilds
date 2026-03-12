import type { PokemonType } from "../types";

// === Triggers ===

export type AbilityTrigger = "on_draw" | "end_of_round" | "on_bust" | "start_of_round";

// === Conditions ===

export type AbilityCondition =
  | { type: "element_count"; element: PokemonType; min: number }
  | { type: "min_cards_played"; min: number }
  | { type: "position"; position: "first" | "last" }
  | { type: "would_bust" }
  | { type: "neighbor_element"; element: PokemonType };

// === Effects ===

export type AbilityEffect =
  | { type: "bonus_distance"; amount: number }
  | { type: "bonus_distance_per"; amount: number; per: "element_count"; element: PokemonType }
  | { type: "reduce_cost"; amount: number | "all"; target: "self" | "all" }
  | { type: "modify_threshold"; amount: number; duration: "route" | "permanent" }
  | { type: "bonus_currency"; amount: number }
  | { type: "peek_deck"; count: number }
  | { type: "reorder_deck"; count: number }
  | { type: "bottom_deck"; count: number }
  | { type: "negate_bust" }
  | { type: "fury_draw" }
  | { type: "echo"; echoEffect: AbilityEffect }
  | { type: "armor"; amount: number; target: "next" | "duds" | "all" }
  | { type: "broadcast"; broadcastId: string; allAmount: number; ownerAmount: number; stat: "currency" | "threshold" | "distance" | "cost"; category: "beneficial" | "taxing" }
  | { type: "hex_currency"; amount: number }
  | { type: "hex_negate" };

// === Move (named ability on a Pokemon) ===

export interface Move {
  readonly name: string;
  readonly reminderText: string;
  readonly trigger: AbilityTrigger;
  readonly condition: AbilityCondition | null;
  readonly effect: AbilityEffect;
}
