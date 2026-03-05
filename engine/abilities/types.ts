import type { PokemonType } from "../types";

// === Triggers ===

export type AbilityTrigger = "on_draw" | "end_of_round" | "on_bust";

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
  | { type: "negate_bust" };

// === Move (named ability on a Pokemon) ===

export interface Move {
  readonly name: string;
  readonly reminderText: string;
  readonly trigger: AbilityTrigger;
  readonly condition: AbilityCondition | null;
  readonly effect: AbilityEffect;
}
