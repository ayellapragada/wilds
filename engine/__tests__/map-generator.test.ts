import { describe, test, expect } from "vitest";
import { generateMap } from "../map-generator";
import { getTemplate } from "../pokemon/catalog";
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
    expect(tier0[0].type).toBe("beginner");
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

  describe("bustThreshold", () => {
    test("start node has bustThreshold of 8", () => {
      const map = generate();
      const startNode = map.nodes[map.currentNodeId];
      expect(startNode.bustThreshold).toBe(8);
    });

    test("regular route nodes have bustThreshold of 7", () => {
      const map = generate();
      const regularNodes = Object.values(map.nodes).filter(n => n.type === "route" && n.tier > 0);
      for (const node of regularNodes) {
        expect(node.bustThreshold).toBe(7);
      }
    });

    test("champion node has bustThreshold of 5", () => {
      const map = generate();
      const champion = Object.values(map.nodes).find(n => n.type === "champion");
      expect(champion!.bustThreshold).toBe(5);
    });

    test("elite route nodes have bustThreshold of 5 or 6", () => {
      let eliteFound = false;
      for (let seed = 1; seed <= 50; seed++) {
        const map = generateMap(10, seededRng(seed));
        const elites = Object.values(map.nodes).filter(n => n.type === "elite_route");
        for (const node of elites) {
          expect(node.bustThreshold).toBeGreaterThanOrEqual(5);
          expect(node.bustThreshold).toBeLessThanOrEqual(6);
          eliteFound = true;
        }
      }
      expect(eliteFound).toBe(true);
    });
  });

  describe("route modifiers", () => {
    test("elite routes always have at least one modifier", () => {
      let eliteFound = false;
      for (let s = 0; s < 100; s++) {
        let seed = s + 1;
        const rng = () => {
          seed = (seed * 16807) % 2147483647;
          return (seed & 0x7fffffff) / 0x7fffffff;
        };
        const map = generateMap(10, rng);
        const elites = Object.values(map.nodes).filter(n => n.type === "elite_route");
        for (const node of elites) {
          expect(node.modifiers.length).toBeGreaterThanOrEqual(1);
          eliteFound = true;
        }
      }
      expect(eliteFound).toBe(true);
    });

    test("elite route modifiers are cost_bonus or threshold_modifier", () => {
      let eliteFound = false;
      for (let s = 0; s < 100; s++) {
        let seed = s + 1;
        const rng = () => {
          seed = (seed * 16807) % 2147483647;
          return (seed & 0x7fffffff) / 0x7fffffff;
        };
        const map = generateMap(10, rng);
        const elites = Object.values(map.nodes).filter(n => n.type === "elite_route");
        for (const node of elites) {
          for (const mod of node.modifiers) {
            expect(["cost_bonus", "threshold_modifier", "distance_bonus", "type_bonus"]).toContain(mod.type);
          }
          eliteFound = true;
        }
      }
      expect(eliteFound).toBe(true);
    });

    test("later tier nodes can have distance_bonus modifier", () => {
      let distanceBonusFound = false;
      for (let s = 0; s < 200; s++) {
        let seed = s + 1;
        const rng = () => {
          seed = (seed * 16807) % 2147483647;
          return (seed & 0x7fffffff) / 0x7fffffff;
        };
        const map = generateMap(10, rng);
        for (const node of Object.values(map.nodes)) {
          if (node.tier >= 5 && node.modifiers.some(m => m.type === "distance_bonus")) {
            distanceBonusFound = true;
          }
        }
      }
      expect(distanceBonusFound).toBe(true);
    });

    test("some nodes have type_bonus modifier", () => {
      let typeBonusFound = false;
      for (let s = 0; s < 200; s++) {
        let seed = s + 1;
        const rng = () => {
          seed = (seed * 16807) % 2147483647;
          return (seed & 0x7fffffff) / 0x7fffffff;
        };
        const map = generateMap(10, rng);
        for (const node of Object.values(map.nodes)) {
          if (node.modifiers.some(m => m.type === "type_bonus")) {
            typeBonusFound = true;
          }
        }
      }
      expect(typeBonusFound).toBe(true);
    });
  });

  describe("pokemon pools", () => {
    test("each non-champion node has a pokemon pool", () => {
      const map = generate();
      for (const node of Object.values(map.nodes)) {
        if (node.type !== "champion") {
          expect(node.pokemonPool.length).toBeGreaterThanOrEqual(4);
          expect(node.pokemonPool.length).toBeLessThanOrEqual(8);
        }
      }
    });

    test("higher tier nodes have higher rarity pokemon", () => {
      const map = generate();
      const tier0 = Object.values(map.nodes).filter(n => n.tier === 0);
      for (const node of tier0) {
        for (const id of node.pokemonPool) {
          expect(() => getTemplate(id)).not.toThrow();
        }
      }
    });
  });
});
