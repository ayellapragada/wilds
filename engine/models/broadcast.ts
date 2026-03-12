import type { ActiveBroadcast } from "../types";

export interface BroadcastModifiers {
  readonly currency: number;
  readonly threshold: number;
  readonly distance: number;
  readonly cost: number;
}

const ZERO_MODIFIERS: BroadcastModifiers = { currency: 0, threshold: 0, distance: 0, cost: 0 };
const STATS = ["currency", "threshold", "distance", "cost"] as const;

export function collapseBroadcasts(broadcasts: readonly ActiveBroadcast[]): ActiveBroadcast[] {
  const best = new Map<string, ActiveBroadcast>();

  for (const b of broadcasts) {
    const existing = best.get(b.stat);
    if (!existing || b.allAmount > existing.allAmount) {
      best.set(b.stat, b);
    }
  }

  return Array.from(best.values());
}

export function applyBroadcasts(
  broadcasts: readonly ActiveBroadcast[],
  playerIds: readonly string[],
): Record<string, BroadcastModifiers> {
  const result: Record<string, BroadcastModifiers> = {};
  for (const id of playerIds) {
    result[id] = { ...ZERO_MODIFIERS };
  }

  if (broadcasts.length === 0) return result;

  const collapsed = collapseBroadcasts(broadcasts);

  // Build a map of ownerId -> ownerAmount per stat (from ALL broadcasts, not just collapsed)
  const ownerBonuses = new Map<string, Map<string, { ownerAmount: number; category: "beneficial" | "taxing" }>>();
  for (const b of broadcasts) {
    if (!ownerBonuses.has(b.stat)) {
      ownerBonuses.set(b.stat, new Map());
    }
    ownerBonuses.get(b.stat)!.set(b.ownerId, { ownerAmount: b.ownerAmount, category: b.category });
  }

  for (const b of collapsed) {
    const base = b.allAmount;

    for (const playerId of playerIds) {
      const mods = result[playerId] as Record<string, number>;
      const ownerInfo = ownerBonuses.get(b.stat)?.get(playerId);

      if (ownerInfo) {
        if (ownerInfo.category === "taxing") {
          // Taxing: owner is exempt, gets their ownerAmount (typically 0)
          mods[b.stat] = ownerInfo.ownerAmount;
        } else {
          // Beneficial: owner gets the better of their personal bonus or the base
          mods[b.stat] = Math.max(ownerInfo.ownerAmount, base);
        }
      } else {
        mods[b.stat] = base;
      }
    }
  }

  return result;
}
