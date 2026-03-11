import { describe, it, expect } from "vitest";
import { calculateSuperlatives } from "../models/superlatives";
import type { TrainerStats } from "../types";

function makeStats(overrides: Partial<TrainerStats> = {}): TrainerStats {
  return { cardsDrawn: 0, bustCount: 0, maxRouteDistance: 0, totalCurrencyEarned: 0, maxCardDistance: 0, finalDeckSize: 5, ...overrides };
}

describe("calculateSuperlatives", () => {
  it("returns empty list for 1 player", () => {
    const stats = { t1: makeStats({ bustCount: 3 }) };
    expect(calculateSuperlatives(stats)).toEqual([]);
  });

  it("awards at most floor(playerCount / 2) superlatives", () => {
    const stats = {
      t1: makeStats({ bustCount: 5, totalCurrencyEarned: 100, maxCardDistance: 10, cardsDrawn: 20, finalDeckSize: 15 }),
      t2: makeStats({ bustCount: 0, totalCurrencyEarned: 50, maxCardDistance: 5, cardsDrawn: 10, finalDeckSize: 8 }),
      t3: makeStats({ bustCount: 2, totalCurrencyEarned: 80, maxCardDistance: 8, cardsDrawn: 15, finalDeckSize: 12 }),
    };
    const result = calculateSuperlatives(stats);
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it("picks superlative with largest margin", () => {
    const stats = {
      t1: makeStats({ bustCount: 10, totalCurrencyEarned: 5 }),
      t2: makeStats({ bustCount: 0, totalCurrencyEarned: 4 }),
    };
    const result = calculateSuperlatives(stats);
    expect(result.length).toBe(1);
    expect(result[0].trainerId).toBe("t1");
    expect(result[0].award).toBe("Daredevil");
  });

  it("does not give same player two awards", () => {
    const stats = {
      t1: makeStats({ bustCount: 10, totalCurrencyEarned: 100, maxCardDistance: 20, finalDeckSize: 20 }),
      t2: makeStats({ bustCount: 0, totalCurrencyEarned: 5, maxCardDistance: 1, finalDeckSize: 5 }),
      t3: makeStats({ bustCount: 1, totalCurrencyEarned: 10, maxCardDistance: 5, finalDeckSize: 8 }),
      t4: makeStats({ bustCount: 2, totalCurrencyEarned: 20, maxCardDistance: 8, finalDeckSize: 10 }),
    };
    const result = calculateSuperlatives(stats);
    const trainerIds = result.map(r => r.trainerId);
    expect(new Set(trainerIds).size).toBe(trainerIds.length);
  });
});
