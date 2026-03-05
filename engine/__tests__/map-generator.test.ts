import { describe, test, expect } from "vitest";
import { generateMap } from "../map-generator";
import type { WorldMap } from "../types";

// Seeded RNG for deterministic tests
function seededRng(seed: number) {
  return () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe("map-generator", () => {
  const defaultTiers = 8;

  function generate(seed = 42) {
    return generateMap(defaultTiers, seededRng(seed));
  }

  test("generates a map with correct number of tiers", () => {
    const map = generate();
    expect(map.totalTiers).toBe(defaultTiers);
  });

  test("tier 0 has exactly one start node", () => {
    const map = generate();
    const tier0 = Object.values(map.nodes).filter(n => n.tier === 0);
    expect(tier0).toHaveLength(1);
    expect(tier0[0].type).toBe("route");
  });

  test("last tier has exactly one champion node", () => {
    const map = generate();
    const lastTier = Object.values(map.nodes).filter(n => n.tier === defaultTiers - 1);
    expect(lastTier).toHaveLength(1);
    expect(lastTier[0].type).toBe("champion");
  });

  test("middle tiers have 2-3 nodes each", () => {
    const map = generate();
    for (let tier = 1; tier < defaultTiers - 1; tier++) {
      const nodes = Object.values(map.nodes).filter(n => n.tier === tier);
      expect(nodes.length).toBeGreaterThanOrEqual(2);
      expect(nodes.length).toBeLessThanOrEqual(3);
    }
  });

  test("all edges point forward (tier N → tier N+1)", () => {
    const map = generate();
    for (const node of Object.values(map.nodes)) {
      for (const connId of node.connections) {
        const target = map.nodes[connId];
        expect(target).toBeDefined();
        expect(target.tier).toBe(node.tier + 1);
      }
    }
  });

  test("every non-start node has at least one incoming edge", () => {
    const map = generate();
    const incoming = new Set<string>();
    for (const node of Object.values(map.nodes)) {
      for (const connId of node.connections) {
        incoming.add(connId);
      }
    }
    for (const node of Object.values(map.nodes)) {
      if (node.tier === 0) continue;
      expect(incoming.has(node.id)).toBe(true);
    }
  });

  test("every non-champion node has at least one outgoing edge", () => {
    const map = generate();
    for (const node of Object.values(map.nodes)) {
      if (node.tier === defaultTiers - 1) continue;
      expect(node.connections.length).toBeGreaterThanOrEqual(1);
    }
  });

  test("champion node has no outgoing connections", () => {
    const map = generate();
    const champion = Object.values(map.nodes).find(n => n.type === "champion");
    expect(champion).toBeDefined();
    expect(champion!.connections).toHaveLength(0);
  });

  test("currentNodeId points to tier 0 start node", () => {
    const map = generate();
    const startNode = map.nodes[map.currentNodeId];
    expect(startNode).toBeDefined();
    expect(startNode.tier).toBe(0);
  });

  test("all nodes start as not visited", () => {
    const map = generate();
    for (const node of Object.values(map.nodes)) {
      expect(node.visited).toBe(false);
    }
  });

  test("some nodes have bonus stops attached", () => {
    let bonusCount = 0;
    let totalNodes = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const map = generateMap(defaultTiers, seededRng(seed));
      for (const node of Object.values(map.nodes)) {
        if (node.tier > 0 && node.tier < defaultTiers - 1) {
          totalNodes++;
          if (node.bonus !== null) bonusCount++;
        }
      }
    }
    expect(bonusCount).toBeGreaterThan(0);
    expect(bonusCount).toBeLessThan(totalNodes);
  });

  test("deterministic with same seed", () => {
    const map1 = generate(99);
    const map2 = generate(99);
    expect(map1).toEqual(map2);
  });

  test("different seeds produce different maps", () => {
    const map1 = generate(1);
    const map2 = generate(2);
    expect(Object.keys(map1.nodes)).not.toEqual(Object.keys(map2.nodes));
  });
});
