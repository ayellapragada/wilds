import type { TrainerStats, Superlative } from "../types";

export type { Superlative };

interface AwardCandidate {
  award: string;
  trainerId: string;
  margin: number;
}

export function calculateSuperlatives(
  allStats: Record<string, TrainerStats>,
): Superlative[] {
  const trainerIds = Object.keys(allStats);
  if (trainerIds.length <= 1) return [];

  const maxAwards = Math.floor(trainerIds.length / 2);

  const candidates: AwardCandidate[] = [];

  const categories: [string, (s: TrainerStats) => number, boolean][] = [
    ["Daredevil", s => s.bustCount, true],
    ["Safe Hands", s => s.bustCount, false],
    ["High Roller", s => s.totalCurrencyEarned, true],
    ["Lucky Draw", s => s.maxCardDistance, true],
    ["Collector", s => s.finalDeckSize, true],
  ];

  for (const [award, extractor, higherIsBetter] of categories) {
    const sorted = [...trainerIds].sort((a, b) => {
      const va = extractor(allStats[a]);
      const vb = extractor(allStats[b]);
      return higherIsBetter ? vb - va : va - vb;
    });

    const winnerId = sorted[0];
    const winnerVal = extractor(allStats[winnerId]);
    const runnerUpVal = extractor(allStats[sorted[1]]);
    const margin = Math.abs(winnerVal - runnerUpVal);

    if (margin > 0) {
      candidates.push({ award, trainerId: winnerId, margin });
    }
  }

  candidates.sort((a, b) => b.margin - a.margin);

  const result: Superlative[] = [];
  const usedTrainers = new Set<string>();

  for (const candidate of candidates) {
    if (result.length >= maxAwards) break;
    if (usedTrainers.has(candidate.trainerId)) continue;
    result.push({ trainerId: candidate.trainerId, award: candidate.award });
    usedTrainers.add(candidate.trainerId);
  }

  return result;
}
