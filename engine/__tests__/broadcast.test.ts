import { describe, it, expect } from "vitest";
import { collapseBroadcasts, applyBroadcasts } from "../models/broadcast";
import type { ActiveBroadcast } from "../types";

function makeBroadcast(overrides: Partial<ActiveBroadcast> & Pick<ActiveBroadcast, "ownerId" | "stat" | "allAmount">): ActiveBroadcast {
  return {
    pokemonName: "TestMon",
    broadcastId: `broadcast-${overrides.ownerId}-${overrides.stat}`,
    ownerAmount: 0,
    category: "beneficial",
    ...overrides,
  };
}

describe("collapseBroadcasts", () => {
  it("collapses same-stat broadcasts to strongest allAmount", () => {
    const broadcasts: ActiveBroadcast[] = [
      makeBroadcast({ ownerId: "p1", stat: "currency", allAmount: 1, ownerAmount: 3 }),
      makeBroadcast({ ownerId: "p2", stat: "currency", allAmount: 2, ownerAmount: 4 }),
    ];

    const result = collapseBroadcasts(broadcasts);
    expect(result).toHaveLength(1);
    expect(result[0].ownerId).toBe("p2");
    expect(result[0].allAmount).toBe(2);
  });

  it("keeps broadcasts with different stats separate", () => {
    const broadcasts: ActiveBroadcast[] = [
      makeBroadcast({ ownerId: "p1", stat: "currency", allAmount: 1 }),
      makeBroadcast({ ownerId: "p2", stat: "distance", allAmount: 2 }),
    ];

    const result = collapseBroadcasts(broadcasts);
    expect(result).toHaveLength(2);
  });
});

describe("applyBroadcasts", () => {
  it("preserves all owner bonuses even when base collapses", () => {
    const broadcasts: ActiveBroadcast[] = [
      makeBroadcast({ ownerId: "p1", stat: "currency", allAmount: 1, ownerAmount: 3 }),
      makeBroadcast({ ownerId: "p2", stat: "currency", allAmount: 2, ownerAmount: 4 }),
    ];

    const result = applyBroadcasts(broadcasts, ["p1", "p2", "p3"]);

    // P2 wins the collapse with allAmount=2
    // P1 is owner of losing broadcast but beneficial → gets max(ownerAmount=3, base=2) = 3
    // P2 is owner of winning broadcast → gets max(ownerAmount=4, base=2) = 4
    // P3 gets the base = 2
    expect(result["p1"].currency).toBe(3);
    expect(result["p2"].currency).toBe(4);
    expect(result["p3"].currency).toBe(2);
  });

  it("returns zero modifiers when no broadcasts", () => {
    const result = applyBroadcasts([], ["p1", "p2"]);

    expect(result["p1"]).toEqual({ currency: 0, threshold: 0, distance: 0, cost: 0 });
    expect(result["p2"]).toEqual({ currency: 0, threshold: 0, distance: 0, cost: 0 });
  });

  it("taxing broadcast: owner is exempt", () => {
    const broadcasts: ActiveBroadcast[] = [
      makeBroadcast({
        ownerId: "darkrai-owner",
        stat: "cost",
        allAmount: 1,
        ownerAmount: 0,
        category: "taxing",
        pokemonName: "Darkrai",
      }),
    ];

    const result = applyBroadcasts(broadcasts, ["darkrai-owner", "victim"]);

    // Owner is exempt from taxing → gets ownerAmount (0)
    expect(result["darkrai-owner"].cost).toBe(0);
    // Others get the tax
    expect(result["victim"].cost).toBe(1);
  });

  it("multiple different-stat broadcasts from same player work independently", () => {
    const broadcasts: ActiveBroadcast[] = [
      makeBroadcast({ ownerId: "p1", stat: "currency", allAmount: 2, ownerAmount: 5 }),
      makeBroadcast({ ownerId: "p1", stat: "distance", allAmount: 3, ownerAmount: 6 }),
    ];

    const result = applyBroadcasts(broadcasts, ["p1", "p2"]);

    expect(result["p1"].currency).toBe(5);
    expect(result["p1"].distance).toBe(6);
    expect(result["p2"].currency).toBe(2);
    expect(result["p2"].distance).toBe(3);
    // Unaffected stats remain 0
    expect(result["p1"].threshold).toBe(0);
    expect(result["p1"].cost).toBe(0);
  });
});
