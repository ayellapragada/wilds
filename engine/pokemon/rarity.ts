import type { RngFn } from "../types";
import { getTemplate } from "./catalog";

export function buildRarityBuckets(allIds: string[]): Record<string, string[]> {
  const buckets: Record<string, string[]> = {};
  for (const id of allIds) {
    const rarity = getTemplate(id).rarity;
    (buckets[rarity] ??= []).push(id);
  }
  return buckets;
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
