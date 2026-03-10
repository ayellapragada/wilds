import type { GameState, GameEvent, Trainer, ResolveResult } from "../types";
import { getAvailableNodes, advanceToNode } from "../models/world-map";
import { freshProgress, createRoute } from "../models/route";

export function handleVote(
  state: GameState,
  action: { type: "cast_vote"; trainerId: string; nodeId: string },
  rng: () => number,
): ResolveResult {
  if (state.phase !== "world") return [state, []];
  if (!state.map || !state.votes) return [state, []];
  if (!state.trainers[action.trainerId]) return [state, []];

  const available = getAvailableNodes(state.map);
  if (!available.some(n => n.id === action.nodeId)) return [state, []];

  const votes = { ...state.votes, [action.trainerId]: action.nodeId };
  const events: GameEvent[] = [
    { type: "vote_cast", trainerId: action.trainerId, nodeId: action.nodeId },
  ];

  const trainerIds = Object.keys(state.trainers);
  const allVoted = trainerIds.every(id => votes[id] !== undefined);

  if (!allVoted) {
    return [{ ...state, votes }, events];
  }

  const tally: Record<string, number> = {};
  for (const nodeId of Object.values(votes)) {
    tally[nodeId] = (tally[nodeId] ?? 0) + 1;
  }

  const totalVotes = Object.values(tally).reduce((a, b) => a + b, 0);
  let roll = rng() * totalVotes;
  let chosenNodeId = Object.keys(tally)[0];
  for (const [nodeId, count] of Object.entries(tally)) {
    roll -= count;
    if (roll <= 0) {
      chosenNodeId = nodeId;
      break;
    }
  }

  events.push({ type: "route_chosen", nodeId: chosenNodeId, votes: tally });

  const newMap = advanceToNode(state.map, chosenNodeId);
  const chosenNode = newMap.nodes[chosenNodeId];

  const routeNumber = state.routeNumber + 1;
  const route = createRoute(routeNumber, chosenNode, trainerIds, rng, newMap.totalTiers);

  const trainers: Record<string, Trainer> = {};
  for (const [id, t] of Object.entries(state.trainers)) {
    trainers[id] = { ...t, status: "exploring", bustThreshold: chosenNode.bustThreshold, routeProgress: freshProgress(), finalRouteDistance: null, finalRouteCost: null };
  }

  events.push({
    type: "route_started",
    routeNumber,
    routeName: chosenNode.name,
    turnOrder: [...trainerIds],
    modifiers: [...chosenNode.modifiers],
  });

  return [{
    ...state,
    phase: "route",
    trainers,
    map: newMap,
    currentRoute: route,
    routeNumber,
    votes: null,
  }, events];
}
