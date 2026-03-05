import type { WorldMap, RouteNode, RouteNodeType, BonusType } from "./types";

export type RngFn = () => number;

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
      // Tier 0: single start node
      const id = `t${tier}_0`;
      nodes[id] = makeNode(id, "route", tier, pickName(), null);
      tierNodeIds.push(id);
    } else if (tier === totalTiers - 1) {
      // Last tier: single champion node
      const id = `t${tier}_0`;
      nodes[id] = makeNode(id, "champion", tier, "Champion Route", null);
      tierNodeIds.push(id);
    } else {
      // Middle tiers: 2-3 nodes
      const count = 2 + (rng() < 0.5 ? 1 : 0);
      const type: RouteNodeType = tier >= 4 && rng() < 0.3 ? "elite_route" : "route";
      for (let i = 0; i < count; i++) {
        const id = `t${tier}_${i}`;
        const nodeType: RouteNodeType = i === 0 ? type : "route";
        const bonus = rng() < 0.3 ? BONUS_TYPES[Math.floor(rng() * BONUS_TYPES.length)] : null;
        nodes[id] = makeNode(id, nodeType, tier, pickName(), bonus);
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

function makeNode(
  id: string, type: RouteNodeType, tier: number,
  name: string, bonus: BonusType | null,
): RouteNode {
  return { id, type, bonus, name, tier, connections: [], modifiers: [], visited: false };
}
