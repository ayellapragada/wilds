import type { RngFn } from "../types";
import { getTemplate, isDud } from "./catalog";

export function buildRarityBuckets(allIds: string[]): Record<string, string[]> {
  const buckets: Record<string, string[]> = {};
  for (const id of allIds) {
    const rarity = getTemplate(id).rarity;
    (buckets[rarity] ??= []).push(id);
  }
  return buckets;
}

export function buildStageBuckets(allIds: string[]): Record<string, string[]> {
  const buckets: Record<string, string[]> = {};
  for (const id of allIds) {
    const stage = getTemplate(id).stage;
    (buckets[stage] ??= []).push(id);
  }
  return buckets;
}

export function pickByTier(
  tier: number,
  totalTiers: number,
  allIds: string[],
  rng: RngFn,
): string {
  const progress = tier / (totalTiers - 1);
  const stageBuckets = buildStageBuckets(allIds);

  // Stage weights by progress
  const stageWeights: Record<string, number> = {
    basic: Math.max(0.1, 1.0 - progress * 0.8),
    stage1: progress * 0.6,
    stage2: progress > 0.5 ? (progress - 0.5) * 0.8 : 0,
  };

  // Pick stage first
  const totalStageWeight = Object.values(stageWeights).reduce((a, b) => a + b, 0);
  let roll = rng() * totalStageWeight;
  let targetStage = "basic";
  for (const [stage, weight] of Object.entries(stageWeights)) {
    roll -= weight;
    if (roll <= 0) { targetStage = stage; break; }
  }

  const candidates = stageBuckets[targetStage];
  if (!candidates?.length) return allIds[Math.floor(rng() * allIds.length)];

  // Filter out duds from pool
  const nonDuds = candidates.filter(id => !isDud(id));
  if (!nonDuds.length) return allIds[Math.floor(rng() * allIds.length)];

  return nonDuds[Math.floor(rng() * nonDuds.length)];
}

export function pickByRarity(
  weights: Record<string, number>,
  buckets: Record<string, string[]>,
  allIds: string[],
  rng: RngFn,
): string {
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = rng() * totalWeight;
  let targetRarity = "common";
  for (const [rarity, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) { targetRarity = rarity; break; }
  }
  const candidates = buckets[targetRarity];
  return candidates?.length
    ? candidates[Math.floor(rng() * candidates.length)]
    : allIds[Math.floor(rng() * allIds.length)];
}
