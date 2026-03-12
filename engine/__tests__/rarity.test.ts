import { describe, it, expect } from "vitest";
import { buildStageBuckets, pickByTier } from "../pokemon/rarity";
import { getAllTemplateIds, getTemplate, isDud } from "../pokemon/catalog";

describe("stage-aware pool generation", () => {
  it("early tiers favor basics", () => {
    const allIds = getAllTemplateIds().filter(id => !isDud(id));
    const results: string[] = [];
    let i = 0;
    const rng = () => { i = (i + 1) % 100; return i / 100; };

    for (let j = 0; j < 50; j++) {
      results.push(pickByTier(1, 8, allIds, rng));
    }

    const stages = results.map(id => getTemplate(id).stage);
    const basicCount = stages.filter(s => s === "basic").length;
    expect(basicCount / results.length).toBeGreaterThan(0.5);
  });

  it("late tiers include evolved pokemon", () => {
    const allIds = getAllTemplateIds().filter(id => !isDud(id));
    const results: string[] = [];
    let i = 0;
    const rng = () => { i = (i + 1) % 100; return i / 100; };

    for (let j = 0; j < 100; j++) {
      results.push(pickByTier(7, 8, allIds, rng));
    }

    const stages = results.map(id => getTemplate(id).stage);
    const hasEvolved = stages.some(s => s === "stage1" || s === "stage2");
    expect(hasEvolved).toBe(true);
  });

  it("buildStageBuckets groups by stage", () => {
    const allIds = getAllTemplateIds();
    const buckets = buildStageBuckets(allIds);
    expect(Object.keys(buckets)).toContain("basic");
    expect(buckets["basic"].length).toBeGreaterThan(0);
  });
});
