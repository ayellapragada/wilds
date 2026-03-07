import type { Route, RouteNode, RouteProgress } from "../types";
import type { RngFn } from "../map-generator";
import { generateTrail } from "./trail";

export function freshProgress(): RouteProgress {
  return { totalDistance: 0, totalCost: 0, pokemonDrawn: 0, activeEffects: [] };
}

export function createRoute(
  routeNumber: number,
  node: RouteNode,
  trainerIds: string[],
  rng: RngFn,
  totalTiers: number = 8,
): Route {
  const trail = generateTrail({
    routeType: node.type,
    tier: node.tier,
    totalTiers,
    currencyDistribution: node.currencyDistribution,
  }, rng);

  return {
    routeNumber,
    name: node.name,
    turnOrder: trainerIds,
    currentTurnIndex: 0,
    trainerResults: {},
    status: "in_progress",
    bustThreshold: node.bustThreshold,
    modifiers: [...node.modifiers],
    trail,
  };
}
