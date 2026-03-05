import type { AbilityCondition, AbilityEffect, AbilityTrigger } from "./types";
import type { Creature, RouteProgress } from "../types";

export function checkCondition(
  condition: AbilityCondition | null,
  creature: Creature,
  drawnCreatures: readonly Creature[],
  progress: RouteProgress,
  bustThreshold: number,
): boolean {
  if (condition === null) return true;

  switch (condition.type) {
    case "element_count": {
      const count = drawnCreatures.filter(c => c.type === condition.element).length;
      return count >= condition.min;
    }
    case "min_cards_played":
      return progress.creaturesDrawn >= condition.min;
    case "position":
      return condition.position === "first"
        ? progress.creaturesDrawn === 1
        : drawnCreatures.length > 0 && progress.creaturesDrawn === drawnCreatures.length;
    case "would_bust":
      return (progress.totalCost + creature.cost) > bustThreshold;
    case "neighbor_element": {
      if (drawnCreatures.length === 0) return false;
      const last = drawnCreatures[drawnCreatures.length - 1];
      return last.type === condition.element;
    }
  }
}

export function resolveAbility(
  creature: Creature,
  trigger: AbilityTrigger,
  drawnCreatures: readonly Creature[],
  progress: RouteProgress,
  bustThreshold: number,
): AbilityEffect | null {
  if (!creature.ability) return null;
  if (creature.ability.trigger !== trigger) return null;
  if (!checkCondition(creature.ability.condition, creature, drawnCreatures, progress, bustThreshold)) return null;

  const effect = creature.ability.effect;

  if (effect.type === "bonus_distance_per") {
    let count = 0;
    if (effect.per === "element_count") {
      count = drawnCreatures.filter(c => c.type === effect.element).length;
    }
    return { type: "bonus_distance", amount: effect.amount * count };
  }

  return effect;
}
