import type { AbilityCondition, AbilityEffect, AbilityTrigger } from "./types";
import type { Pokemon, RouteProgress } from "../types";

export function checkCondition(
  condition: AbilityCondition | null,
  pokemon: Pokemon,
  drawnPokemon: readonly Pokemon[],
  progress: RouteProgress,
  bustThreshold: number,
): boolean {
  if (condition === null) return true;

  switch (condition.type) {
    case "element_count": {
      const count = drawnPokemon.filter(p => p.types.includes(condition.element)).length;
      return count >= condition.min;
    }
    case "min_cards_played":
      return progress.pokemonDrawn >= condition.min;
    case "position":
      return condition.position === "first"
        ? progress.pokemonDrawn === 1
        : drawnPokemon.length > 0 && progress.pokemonDrawn === drawnPokemon.length;
    case "would_bust":
      return (progress.totalCost + pokemon.cost) > bustThreshold;
    case "neighbor_element": {
      if (drawnPokemon.length === 0) return false;
      const last = drawnPokemon[drawnPokemon.length - 1];
      return last.types.includes(condition.element);
    }
  }
}

export function resolveMoves(
  pokemon: Pokemon,
  trigger: AbilityTrigger,
  drawnPokemon: readonly Pokemon[],
  progress: RouteProgress,
  bustThreshold: number,
): AbilityEffect[] {
  const effects: AbilityEffect[] = [];

  for (const move of pokemon.moves) {
    if (move.trigger !== trigger) continue;
    if (!checkCondition(move.condition, pokemon, drawnPokemon, progress, bustThreshold)) continue;

    const effect = move.effect;
    if (effect.type === "bonus_distance_per") {
      let count = 0;
      if (effect.per === "element_count") {
        count = drawnPokemon.filter(p => p.types.includes(effect.element)).length;
      }
      effects.push({ type: "bonus_distance", amount: effect.amount * count });
    } else {
      effects.push(effect);
    }
  }

  return effects;
}
