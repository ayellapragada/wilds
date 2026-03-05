import type { Creature } from "../types";

let creatureIdCounter = 0;

export function resetCreatureIdCounter() {
  creatureIdCounter = 0;
}

function makeCreature(template: Omit<Creature, "id">): Creature {
  return { ...template, id: `creature_${creatureIdCounter++}` };
}

export function createStarterTeam(): Creature[] {
  return [
    // 3x Scout — safe, low reward
    ...Array.from({ length: 3 }, () => makeCreature({
      templateId: "scout", name: "Scout", type: "light",
      distance: 1, cost: 1, abilityId: null, rarity: "common",
      description: "A simple explorer.",
    })),
    // 3x Wanderer — moderate
    ...Array.from({ length: 3 }, () => makeCreature({
      templateId: "wanderer", name: "Wanderer", type: "earth",
      distance: 2, cost: 2, abilityId: null, rarity: "common",
      description: "Steady and reliable.",
    })),
    // 1x Spark — higher risk/reward
    makeCreature({
      templateId: "spark", name: "Spark", type: "fire",
      distance: 3, cost: 3, abilityId: null, rarity: "common",
      description: "Quick and volatile.",
    }),
    // 1x Ripple — efficient (good ratio)
    makeCreature({
      templateId: "ripple", name: "Ripple", type: "water",
      distance: 2, cost: 1, abilityId: null, rarity: "common",
      description: "Calm and efficient.",
    }),
    // 1x Gust — risky
    makeCreature({
      templateId: "gust", name: "Gust", type: "air",
      distance: 3, cost: 4, abilityId: null, rarity: "common",
      description: "Powerful but unpredictable.",
    }),
  ];
  // 9 creatures total. Max possible distance: 17, max possible cost: 17
  // Base bust threshold: 10
  // Sweet spot: draw 4-5 creatures safely for ~8-10 distance
}

export const CREATURE_CATALOG = {
  // COMMON (marketplace cost: 2-3 currency)
  fire_imp:     { name: "Fire Imp",     type: "fire" as const,   distance: 3, cost: 2, rarity: "common" as const, abilityId: null, description: "Small but fierce." },
  stone_turtle: { name: "Stone Turtle", type: "earth" as const,  distance: 1, cost: 0, rarity: "common" as const, abilityId: "stonewall", description: "+2 bust threshold while drawn." },
  zephyr:       { name: "Zephyr",       type: "air" as const,    distance: 4, cost: 3, rarity: "common" as const, abilityId: null, description: "Swift winds carry far." },
  brook_sprite: { name: "Brook Sprite", type: "water" as const,  distance: 2, cost: 1, rarity: "common" as const, abilityId: "tidal_shield", description: "-1 cost per water creature drawn." },

  // UNCOMMON (marketplace cost: 4-6 currency)
  fire_drake:   { name: "Fire Drake",   type: "fire" as const,   distance: 5, cost: 4, rarity: "uncommon" as const, abilityId: "fire_amplifier", description: "+1 distance per other fire creature this route." },
  golem:        { name: "Golem",        type: "earth" as const,  distance: 2, cost: 1, rarity: "uncommon" as const, abilityId: "earthquake", description: "If 3+ earth creatures drawn, +5 distance." },
  storm_hawk:   { name: "Storm Hawk",   type: "air" as const,    distance: 6, cost: 5, rarity: "uncommon" as const, abilityId: null, description: "Soars high, costs much." },
  tide_caller:  { name: "Tide Caller",  type: "water" as const,  distance: 3, cost: 2, rarity: "uncommon" as const, abilityId: "cleanse", description: "Removes 2 cost when drawn." },
  shadow_fox:   { name: "Shadow Fox",   type: "shadow" as const, distance: 4, cost: 3, rarity: "uncommon" as const, abilityId: "dodge", description: "If this would bust you, ignore its cost." },

  // RARE (marketplace cost: 7-9 currency)
  phoenix:      { name: "Phoenix",      type: "fire" as const,   distance: 8, cost: 7, rarity: "rare" as const, abilityId: "rebirth", description: "If you bust, undo it — but lose Phoenix forever." },
  ancient_oak:  { name: "Ancient Oak",  type: "earth" as const,  distance: 3, cost: 0, rarity: "rare" as const, abilityId: "deep_roots", description: "+3 threshold if drawn 1st or 2nd." },
  leviathan:    { name: "Leviathan",    type: "water" as const,  distance: 10, cost: 8, rarity: "rare" as const, abilityId: "tsunami", description: "Sets all other costs to 0, own cost becomes 6." },
  nightmare:    { name: "Nightmare",    type: "shadow" as const, distance: 0, cost: 0, rarity: "rare" as const, abilityId: "gamble", description: "Distance AND cost = creatures drawn × 2." },

  // LEGENDARY (champion route rewards, rare events only)
  dragon_king:  { name: "Dragon King",  type: "fire" as const,   distance: 12, cost: 10, rarity: "legendary" as const, abilityId: "inferno", description: "Doubles all fire distance. Also doubles fire cost." },
  world_tree:   { name: "World Tree",   type: "earth" as const,  distance: 5, cost: 0, rarity: "legendary" as const, abilityId: "sanctuary", description: "Can't bust this route. Score is halved." },
} as const;
