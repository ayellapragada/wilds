import type { Trail, TrailSpot, RouteNodeType } from "../types";
import type { RngFn } from "../map-generator";

export interface TrailConfig {
  readonly routeType: RouteNodeType;
  readonly tier: number;
  readonly totalTiers: number;
}

export function generateTrail(config: TrailConfig, _rng: RngFn): Trail {
  const length = trailLength(config);
  const vpValues = distributeVP(config.routeType, length, config);

  const spots: TrailSpot[] = vpValues.map((vp, index) => ({
    index,
    vp,
    distanceCost: 1,
  }));

  return { spots };
}

/** Walk the trail spending distance, return the spot index reached. */
export function getTrailPosition(trail: Trail, totalDistance: number): number {
  let remaining = totalDistance;
  let position = 0;
  for (let i = 1; i < trail.spots.length; i++) {
    if (remaining < trail.spots[i].distanceCost) break;
    remaining -= trail.spots[i].distanceCost;
    position = i;
  }
  return position;
}

function trailLength(config: TrailConfig): number {
  const base = 20;
  const tierBonus = Math.floor(config.tier * 1.5);
  const typeBonus =
    config.routeType === "champion" ? 8 :
    config.routeType === "elite_route" ? 5 : 0;
  return base + tierBonus + typeBonus;
}

/**
 * VP always increases along the trail. The curve shape varies by route type:
 * - Beginner: diminishing returns (sqrt) — prevents snowballing early game
 * - Normal: linear — steady, predictable climb
 * - Elite/Champion: accelerating (cubic) — big payoff for pushing deep
 */
function maxVP(config: TrailConfig): number {
  const tierBonus = config.tier;
  const baseMax =
    config.routeType === "champion" ? 14 :
    config.routeType === "elite_route" ? 12 :
    config.routeType === "beginner" ? 7 : 9;
  return baseMax + tierBonus;
}

function distributeVP(routeType: RouteNodeType, length: number, config: TrailConfig): number[] {
  const vps = new Array(length).fill(0);
  // Spot 0 always has 0 VP (starting position before any movement)

  if (length <= 1) return vps;

  const cap = maxVP(config);

  for (let i = 1; i < length; i++) {
    const t = i / (length - 1); // 0..1 across the trail
    let frac: number;
    switch (routeType) {
      case "beginner":
        // Diminishing returns — sqrt curve
        frac = Math.sqrt(t);
        break;
      case "elite_route":
      case "champion":
        // Accelerating — cubic curve, big payoff at the end
        frac = t * t * t;
        break;
      default:
        // Normal — linear, steady climb
        frac = t;
        break;
    }
    vps[i] = Math.max(1, Math.round(frac * cap));
  }

  return vps;
}
