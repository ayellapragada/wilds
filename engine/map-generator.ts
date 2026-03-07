import type { WorldMap, RouteNode, RouteNodeType, BonusType, PokemonType, RouteModifier, CurrencyDistribution, RngFn } from "./types";
import { getAllTemplateIds } from "./pokemon/catalog";
import { buildRarityBuckets, pickByRarity } from "./pokemon/rarity";
import { copy, modTypeTerrain } from "../copy";

const ROUTE_NAMES = [
  "Ember Trail", "Misty Hollow", "Stone Pass", "Gale Ridge", "Shadow Vale",
  "Crystal Cave", "Thunder Peak", "Frost Meadow", "Coral Beach", "Vine Thicket",
  "Ashen Wastes", "Lunar Path", "Iron Gorge", "Silk Forest", "Storm Basin",
  "Dusk Marsh", "Flame Canyon", "Tide Pool", "Moss Tunnel", "Sky Bridge",
];

const BONUS_TYPES: BonusType[] = ["marketplace", "rest_stop", "event"];

export function generateMap(totalTiers: number, rng: RngFn): WorldMap {
  const nodes: Record<string, RouteNode> = {};
  const tiers: string[][] = [];
  let nameIndex = 0;

  function pickName(): string {
    const name = ROUTE_NAMES[nameIndex % ROUTE_NAMES.length];
    nameIndex++;
    return name;
  }

  // Generate nodes for each tier
  for (let tier = 0; tier < totalTiers; tier++) {
    const tierNodeIds: string[] = [];

    if (tier === 0) {
      // Tier 0: single beginner start node
      const id = `t${tier}_0`;
      nodes[id] = makeNode(id, "beginner", tier, pickName(), null, generatePokemonPool(tier, totalTiers, rng), 8, [], defaultCurrencyDistribution("beginner"));
      tierNodeIds.push(id);
    } else if (tier === totalTiers - 1) {
      // Last tier: single champion node
      const id = `t${tier}_0`;
      nodes[id] = makeNode(id, "champion", tier, "Champion Route", null, [], 5, [], defaultCurrencyDistribution("champion"));
      tierNodeIds.push(id);
    } else {
      // Middle tiers: 2-3 nodes
      const count = 2 + (rng() < 0.5 ? 1 : 0);
      const defaultType: RouteNodeType = tier <= 1 ? "beginner" : "route";
      const type: RouteNodeType = tier >= 4 && rng() < 0.3 ? "elite_route" : defaultType;
      for (let i = 0; i < count; i++) {
        const id = `t${tier}_${i}`;
        const nodeType: RouteNodeType = i === 0 ? type : defaultType;
        const bonus = rng() < 0.3 ? BONUS_TYPES[Math.floor(rng() * BONUS_TYPES.length)] : null;
        const bustThreshold = nodeType === "elite_route" ? (5 + Math.floor(rng() * 2)) : 7;
        const modifiers = generateModifiers(nodeType, tier, totalTiers, rng);
        nodes[id] = makeNode(id, nodeType, tier, pickName(), bonus, generatePokemonPool(tier, totalTiers, rng), bustThreshold, modifiers, defaultCurrencyDistribution(nodeType));
        tierNodeIds.push(id);
      }
    }

    tiers.push(tierNodeIds);
  }

  // Generate edges between tiers
  for (let tier = 0; tier < totalTiers - 1; tier++) {
    const currentTier = tiers[tier];
    const nextTier = tiers[tier + 1];

    // Each node in current tier connects to 1-2 nodes in next tier
    for (const nodeId of currentTier) {
      const connCount = nextTier.length === 1 ? 1 : (rng() < 0.5 ? 1 : 2);
      const connections: string[] = [];
      const shuffled = [...nextTier].sort(() => rng() - 0.5);
      for (let i = 0; i < Math.min(connCount, shuffled.length); i++) {
        connections.push(shuffled[i]);
      }
      nodes[nodeId] = { ...nodes[nodeId], connections };
    }

    // Ensure every node in next tier has at least one incoming edge
    for (const nextId of nextTier) {
      const hasIncoming = currentTier.some(id => nodes[id].connections.includes(nextId));
      if (!hasIncoming) {
        const sourceId = currentTier[Math.floor(rng() * currentTier.length)];
        nodes[sourceId] = {
          ...nodes[sourceId],
          connections: [...nodes[sourceId].connections, nextId],
        };
      }
    }
  }

  return { nodes, currentNodeId: tiers[0][0], totalTiers };
}


function generatePokemonPool(tier: number, totalTiers: number, rng: RngFn): string[] {
  const allIds = getAllTemplateIds();
  const buckets = buildRarityBuckets(allIds);
  const poolSize = 4 + Math.floor(rng() * 3); // 4-6 pokemon

  const progress = tier / (totalTiers - 1);
  const weights: Record<string, number> = {
    common: Math.max(0.1, 1 - progress),
    uncommon: 0.3 + progress * 0.2,
    rare: progress * 0.4,
    legendary: progress > 0.7 ? (progress - 0.7) * 1.0 : 0,
  };

  return Array.from({ length: poolSize }, () => pickByRarity(weights, buckets, allIds, rng));
}

const TYPE_BONUS_TYPES: PokemonType[] = [
  "fire", "water", "grass", "electric", "rock", "ground", "flying",
  "psychic", "dark", "steel", "ghost", "dragon", "fairy",
];

function generateModifiers(
  type: RouteNodeType, tier: number, _totalTiers: number, rng: RngFn,
): RouteModifier[] {
  const modifiers: RouteModifier[] = [];

  // Elite routes always get a harsh modifier
  if (type === "elite_route") {
    if (rng() < 0.5) {
      modifiers.push({ id: "elite_cost", description: copy.modHarshTerrain, type: "cost_bonus", value: 1 });
    } else {
      modifiers.push({ id: "elite_threshold", description: copy.modThinAir, type: "threshold_modifier", value: -1 });
    }
  }

  // Later tiers: 30% chance of distance bonus
  if (tier >= 5 && type !== "champion" && rng() < 0.3) {
    modifiers.push({ id: "deep_bonus", description: copy.modTailwind, type: "distance_bonus", value: 1 });
  }

  // 20% chance of type bonus (not on champion/start)
  if (tier > 0 && type !== "champion" && rng() < 0.2) {
    const bonusType = TYPE_BONUS_TYPES[Math.floor(rng() * TYPE_BONUS_TYPES.length)];
    modifiers.push({
      id: `type_${bonusType}`,
      description: modTypeTerrain(bonusType),
      type: "type_bonus",
      value: 2,
      targetType: bonusType,
    });
  }

  return modifiers;
}

function defaultCurrencyDistribution(_type: RouteNodeType): CurrencyDistribution {
  return { total: 3, curve: "flat" };
}

function makeNode(
  id: string, type: RouteNodeType, tier: number,
  name: string, bonus: BonusType | null, pokemonPool: string[],
  bustThreshold: number, modifiers: RouteModifier[],
  currencyDistribution: CurrencyDistribution,
): RouteNode {
  return { id, type, bonus, name, tier, connections: [], bustThreshold, modifiers, currencyDistribution, visited: false, pokemonPool };
}
