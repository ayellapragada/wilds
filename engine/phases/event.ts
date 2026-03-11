import type { RouteEvent, RngFn, PokemonType } from "../types";

const EVENT_POOL: ((tier: number, totalTiers: number, rng: RngFn) => RouteEvent)[] = [
  () => ({
    type: "modifier",
    modifier: { id: "sandstorm", description: "Sandstorm: +1 fatigue to all draws", type: "cost_bonus", value: 1 },
    name: "Sandstorm",
    description: "A harsh sandstorm increases fatigue on all draws.",
  }),
  () => ({
    type: "modifier",
    modifier: { id: "tailwind", description: "Tailwind: +2 distance to all draws", type: "distance_bonus", value: 2 },
    name: "Tailwind",
    description: "A strong tailwind boosts distance on all draws.",
  }),
  (_tier, _totalTiers, rng) => {
    const types: PokemonType[] = ["fire", "water", "grass", "electric", "rock", "dragon"];
    const bonusType = types[Math.floor(rng() * types.length)];
    return {
      type: "modifier",
      modifier: { id: `surge_${bonusType}`, description: `${bonusType} surge: ${bonusType}-type get +3 distance`, type: "type_bonus", value: 3, targetType: bonusType },
      name: `${bonusType.charAt(0).toUpperCase() + bonusType.slice(1)} Surge`,
      description: `${bonusType}-type Pokémon surge with extra distance.`,
    };
  },
  () => ({
    type: "fog",
    name: "Fog",
    description: "Dense fog hides the bust threshold until you're close.",
  }),
  () => ({
    type: "bounty",
    name: "Bounty",
    description: "A bounty doubles currency rewards on this route.",
  }),
];

export function generateEvent(tier: number, totalTiers: number, rng: RngFn): RouteEvent | null {
  const idx = Math.floor(rng() * EVENT_POOL.length);
  return EVENT_POOL[idx](tier, totalTiers, rng);
}
