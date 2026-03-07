import { describe, test, expect } from "vitest";
import { generateTrail, getTrailPosition, type TrailConfig } from "../models/trail";
import type { CurrencyDistribution } from "../types";

function seededRng(seed = 42): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

const defaultCurrency: CurrencyDistribution = { total: 3, curve: "flat" };
const beginnerConfig: TrailConfig = { routeType: "beginner", tier: 0, totalTiers: 8, currencyDistribution: defaultCurrency };
const normalConfig: TrailConfig = { routeType: "route", tier: 3, totalTiers: 8, currencyDistribution: defaultCurrency };
const eliteConfig: TrailConfig = { routeType: "elite_route", tier: 4, totalTiers: 8, currencyDistribution: defaultCurrency };
const championConfig: TrailConfig = { routeType: "champion", tier: 7, totalTiers: 8, currencyDistribution: defaultCurrency };

describe("trail generation", () => {
  test("generates a trail with spots", () => {
    const trail = generateTrail(normalConfig, seededRng());
    expect(trail.spots.length).toBeGreaterThan(0);
  });

  test("spot at index 0 has VP = 0", () => {
    const trail = generateTrail(normalConfig, seededRng());
    expect(trail.spots[0].vp).toBe(0);
  });

  test("all spots have distanceCost defaulting to 1", () => {
    const trail = generateTrail(normalConfig, seededRng());
    for (const spot of trail.spots) {
      expect(spot.distanceCost).toBe(1);
    }
  });

  test("spot indices are sequential from 0", () => {
    const trail = generateTrail(normalConfig, seededRng());
    trail.spots.forEach((spot, i) => {
      expect(spot.index).toBe(i);
    });
  });

  test("all movable spots (index > 0) have at least 1 VP", () => {
    const trail = generateTrail(normalConfig, seededRng());
    for (const spot of trail.spots) {
      if (spot.index === 0) continue;
      expect(spot.vp).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(spot.vp)).toBe(true);
    }
  });

  test("elite routes are longer than normal routes at same tier", () => {
    const rng1 = seededRng();
    const rng2 = seededRng();
    const normal = generateTrail({ routeType: "route", tier: 4, totalTiers: 8, currencyDistribution: defaultCurrency }, rng1);
    const elite = generateTrail({ routeType: "elite_route", tier: 4, totalTiers: 8, currencyDistribution: defaultCurrency }, rng2);
    expect(elite.spots.length).toBeGreaterThan(normal.spots.length);
  });

  test("champion routes are longer than elite routes", () => {
    const rng1 = seededRng();
    const rng2 = seededRng();
    const elite = generateTrail(eliteConfig, rng1);
    const champion = generateTrail(championConfig, rng2);
    expect(champion.spots.length).toBeGreaterThan(elite.spots.length);
  });

  test("higher tier routes are longer", () => {
    const rng1 = seededRng();
    const rng2 = seededRng();
    const early = generateTrail({ routeType: "route", tier: 0, totalTiers: 8, currencyDistribution: defaultCurrency }, rng1);
    const late = generateTrail({ routeType: "route", tier: 6, totalTiers: 8, currencyDistribution: defaultCurrency }, rng2);
    expect(late.spots.length).toBeGreaterThan(early.spots.length);
  });

  test("VP is monotonically increasing (always goes up or stays same)", () => {
    const trail = generateTrail(normalConfig, seededRng());
    for (let i = 2; i < trail.spots.length; i++) {
      expect(trail.spots[i].vp).toBeGreaterThanOrEqual(trail.spots[i - 1].vp);
    }
  });

  test("beginner routes have diminishing returns (first quarter gains more than last)", () => {
    const trail = generateTrail(beginnerConfig, seededRng());
    const q1 = trail.spots[Math.floor(trail.spots.length * 0.25)].vp - trail.spots[1].vp;
    const lastIdx = trail.spots.length - 1;
    const q4Start = Math.floor(trail.spots.length * 0.75);
    const q4 = trail.spots[lastIdx].vp - trail.spots[q4Start].vp;
    expect(q1).toBeGreaterThanOrEqual(q4);
  });

  test("normal routes climb linearly", () => {
    const trail = generateTrail(normalConfig, seededRng());
    // VP at midpoint should be roughly half of max
    const mid = Math.floor(trail.spots.length / 2);
    const maxVP = trail.spots[trail.spots.length - 1].vp;
    const midVP = trail.spots[mid].vp;
    // Allow some rounding tolerance: mid VP should be within 30% of half max
    expect(midVP).toBeGreaterThanOrEqual(maxVP * 0.3);
    expect(midVP).toBeLessThanOrEqual(maxVP * 0.7);
  });

  test("elite routes gain VP faster late (accelerating)", () => {
    const trail = generateTrail(eliteConfig, seededRng());
    const q1 = trail.spots[Math.floor(trail.spots.length * 0.25)].vp - trail.spots[1].vp;
    const lastIdx = trail.spots.length - 1;
    const q4Start = Math.floor(trail.spots.length * 0.75);
    const q4 = trail.spots[lastIdx].vp - trail.spots[q4Start].vp;
    expect(q4).toBeGreaterThan(q1);
  });

  test("higher tier routes have higher max VP per spot", () => {
    const rng1 = seededRng();
    const rng2 = seededRng();
    const early = generateTrail({ routeType: "route", tier: 1, totalTiers: 8, currencyDistribution: defaultCurrency }, rng1);
    const late = generateTrail({ routeType: "route", tier: 6, totalTiers: 8, currencyDistribution: defaultCurrency }, rng2);
    const earlyMax = Math.max(...early.spots.map(s => s.vp));
    const lateMax = Math.max(...late.spots.map(s => s.vp));
    expect(lateMax).toBeGreaterThan(earlyMax);
  });
});

describe("getTrailPosition", () => {
  test("returns 0 for 0 distance", () => {
    const trail = generateTrail(normalConfig, seededRng());
    expect(getTrailPosition(trail, 0)).toBe(0);
  });

  test("returns distance when all spots cost 1", () => {
    const trail = generateTrail(normalConfig, seededRng());
    expect(getTrailPosition(trail, 3)).toBe(3);
  });

  test("clamps to last spot index when distance exceeds trail length", () => {
    const trail = generateTrail(normalConfig, seededRng());
    expect(getTrailPosition(trail, 999)).toBe(trail.spots.length - 1);
  });
});

describe("trail currency distribution", () => {
  test("spot 0 always has 0 currency", () => {
    const trail = generateTrail({ ...normalConfig, currencyDistribution: { total: 5, curve: "flat" } }, seededRng());
    expect(trail.spots[0].currency).toBe(0);
  });

  test("flat curve gives same currency to all non-zero spots", () => {
    const trail = generateTrail({ ...normalConfig, currencyDistribution: { total: 3, curve: "flat" } }, seededRng());
    for (const spot of trail.spots) {
      if (spot.index === 0) continue;
      expect(spot.currency).toBe(3);
    }
  });

  test("linear curve increases currency toward end", () => {
    const trail = generateTrail({ ...normalConfig, currencyDistribution: { total: 10, curve: "linear" } }, seededRng());
    const mid = Math.floor(trail.spots.length / 2);
    const maxCurrency = trail.spots[trail.spots.length - 1].currency;
    const midCurrency = trail.spots[mid].currency;
    expect(midCurrency).toBeGreaterThanOrEqual(maxCurrency * 0.3);
    expect(midCurrency).toBeLessThanOrEqual(maxCurrency * 0.7);
  });

  test("accelerating curve has more currency late", () => {
    const trail = generateTrail({ ...normalConfig, currencyDistribution: { total: 10, curve: "accelerating" } }, seededRng());
    const q1 = trail.spots[Math.floor(trail.spots.length * 0.25)].currency - trail.spots[1].currency;
    const lastIdx = trail.spots.length - 1;
    const q4Start = Math.floor(trail.spots.length * 0.75);
    const q4 = trail.spots[lastIdx].currency - trail.spots[q4Start].currency;
    expect(q4).toBeGreaterThan(q1);
  });

  test("front_loaded curve has more currency early", () => {
    const trail = generateTrail({ ...normalConfig, currencyDistribution: { total: 10, curve: "front_loaded" } }, seededRng());
    const q1 = trail.spots[Math.floor(trail.spots.length * 0.25)].currency - trail.spots[1].currency;
    const lastIdx = trail.spots.length - 1;
    const q4Start = Math.floor(trail.spots.length * 0.75);
    const q4 = trail.spots[lastIdx].currency - trail.spots[q4Start].currency;
    expect(q1).toBeGreaterThanOrEqual(q4);
  });
});
