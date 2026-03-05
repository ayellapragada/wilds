import type { Route, RouteNode, RouteProgress } from "../types";

export function freshProgress(): RouteProgress {
  return { totalDistance: 0, totalCost: 0, pokemonDrawn: 0, activeEffects: [] };
}

export function createRoute(
  routeNumber: number,
  node: RouteNode,
  trainerIds: string[],
): Route {
  return {
    routeNumber,
    name: node.name,
    turnOrder: trainerIds,
    currentTurnIndex: 0,
    trainerResults: {},
    status: "in_progress",
    modifiers: [...node.modifiers],
  };
}
