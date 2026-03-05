import { describe, test, expect } from "vitest";
import { resolveAction } from "../action-resolver";
import { createInitialState } from "../index";
import type { GameState, WorldMap, RouteNode } from "../types";

function castVote(state: GameState, trainerId: string, nodeId: string) {
  return resolveAction(state, { type: "cast_vote", trainerId, nodeId });
}

/** Create a minimal world-phase state with a simple map for testing */
function worldPhaseState(trainerCount: number): GameState {
  let state = createInitialState("TEST");
  for (let i = 0; i < trainerCount; i++) {
    [state] = resolveAction(state, { type: "join_game", trainerName: `T${i}`, sessionToken: `t${i}` });
  }

  // Build a tiny test map: start → [nodeA, nodeB] → champion
  const nodes: Record<string, RouteNode> = {
    start: { id: "start", type: "route", bonus: null, name: "Start", tier: 0, connections: ["nodeA", "nodeB"], modifiers: [], visited: true, creaturePool: [] },
    nodeA: { id: "nodeA", type: "route", bonus: null, name: "Route A", tier: 1, connections: ["champ"], modifiers: [], visited: false, creaturePool: ["scout", "wanderer", "spark"] },
    nodeB: { id: "nodeB", type: "route", bonus: "marketplace", name: "Route B", tier: 1, connections: ["champ"], modifiers: [], visited: false, creaturePool: [] },
    champ: { id: "champ", type: "champion", bonus: null, name: "Champion", tier: 2, connections: [], modifiers: [], visited: false, creaturePool: [] },
  };

  const map: WorldMap = { nodes, currentNodeId: "start", totalTiers: 3 };

  return {
    ...state,
    phase: "world",
    map,
    votes: {},
    trainers: Object.fromEntries(
      Object.entries(state.trainers).map(([id, t]) => [id, { ...t, status: "waiting" as const }])
    ),
  };
}

describe("voting", () => {
  test("cast_vote records a vote", () => {
    const state = worldPhaseState(2);
    const [next, events] = castVote(state, "t0", "nodeA");

    expect(next.votes).toEqual({ t0: "nodeA" });
    expect(events).toContainEqual({ type: "vote_cast", trainerId: "t0", nodeId: "nodeA" });
  });

  test("trainer can change their vote", () => {
    let state = worldPhaseState(2);
    [state] = castVote(state, "t0", "nodeA");
    [state] = castVote(state, "t0", "nodeB");

    expect(state.votes).toEqual({ t0: "nodeB" });
  });

  test("rejected if not in world phase", () => {
    let state = createInitialState("TEST");
    [state] = resolveAction(state, { type: "join_game", trainerName: "T0", sessionToken: "t0" });

    const [next, events] = castVote(state, "t0", "nodeA");
    expect(events).toEqual([]);
  });

  test("rejected for invalid node (not a connection from current)", () => {
    const state = worldPhaseState(1);
    const [next, events] = castVote(state, "t0", "champ");

    expect(events).toEqual([]);
    expect(next.votes).toEqual({});
  });

  test("rejected for non-existent trainer", () => {
    const state = worldPhaseState(1);
    const [next, events] = castVote(state, "nobody", "nodeA");

    expect(events).toEqual([]);
  });

  test("all trainers voting triggers route selection", () => {
    let state = worldPhaseState(2);
    [state] = castVote(state, "t0", "nodeA");
    const [next, events] = castVote(state, "t1", "nodeA");

    expect(next.phase).toBe("route");
    expect(events.some(e => e.type === "route_chosen")).toBe(true);
  });

  test("route_chosen event includes vote tallies", () => {
    let state = worldPhaseState(3);
    [state] = castVote(state, "t0", "nodeA");
    [state] = castVote(state, "t1", "nodeA");
    const [, events] = castVote(state, "t2", "nodeB");

    const chosen = events.find(e => e.type === "route_chosen");
    expect(chosen).toBeDefined();
    if (chosen && chosen.type === "route_chosen") {
      expect(chosen.votes).toEqual({ nodeA: 2, nodeB: 1 });
    }
  });

  test("weighted random: unanimous vote always picks that node", () => {
    let state = worldPhaseState(3);
    [state] = castVote(state, "t0", "nodeA");
    [state] = castVote(state, "t1", "nodeA");
    const [next] = castVote(state, "t2", "nodeA");

    expect(next.map!.currentNodeId).toBe("nodeA");
  });

  test("map advances to chosen node and marks it visited", () => {
    let state = worldPhaseState(1);
    const [next] = castVote(state, "t0", "nodeA");

    expect(next.map!.currentNodeId).toBe("nodeA");
    expect(next.map!.nodes["nodeA"].visited).toBe(true);
  });

  test("trainers are set to exploring after vote resolves", () => {
    let state = worldPhaseState(2);
    [state] = castVote(state, "t0", "nodeA");
    const [next] = castVote(state, "t1", "nodeA");

    for (const trainer of Object.values(next.trainers)) {
      expect(trainer.status).toBe("exploring");
    }
  });

  test("a new route is created from the chosen node", () => {
    let state = worldPhaseState(2);
    [state] = castVote(state, "t0", "nodeA");
    const [next] = castVote(state, "t1", "nodeA");

    expect(next.currentRoute).not.toBeNull();
    expect(next.currentRoute!.status).toBe("in_progress");
    expect(next.currentRoute!.name).toBe("Route A");
  });

  test("votes are cleared after resolution", () => {
    let state = worldPhaseState(1);
    const [next] = castVote(state, "t0", "nodeA");

    expect(next.votes).toBeNull();
  });
});

describe("full vote cycle integration", () => {
  test("start_game generates a map", () => {
    let state = createInitialState("TEST");
    [state] = resolveAction(state, { type: "join_game", trainerName: "Ash", sessionToken: "t0" });
    const [next, events] = resolveAction(state, { type: "start_game", trainerId: "t0" });

    expect(next.map).not.toBeNull();
    expect(next.map!.totalTiers).toBe(next.settings.mapTiers);
    expect(events.some(e => e.type === "game_started")).toBe(true);
  });

  test("start_game marks first node as visited", () => {
    let state = createInitialState("TEST");
    [state] = resolveAction(state, { type: "join_game", trainerName: "Ash", sessionToken: "t0" });
    const [next] = resolveAction(state, { type: "start_game", trainerId: "t0" });

    const startNode = next.map!.nodes[next.map!.currentNodeId];
    expect(startNode.visited).toBe(true);
    expect(startNode.tier).toBe(0);
  });

  test("route completion enters world phase with vote options", () => {
    const state = worldPhaseState(1);

    expect(state.phase).toBe("world");
    expect(state.map).not.toBeNull();

    const current = state.map!.nodes[state.map!.currentNodeId];
    expect(current.connections).toContain("nodeA");
    expect(current.connections).toContain("nodeB");
  });

  test("champion route completion triggers game over", () => {
    // Set up state at champion node
    let state = worldPhaseState(1);
    // Vote to nodeA, which connects to champ
    [state] = castVote(state, "t0", "nodeA");
    // Now in route phase at nodeA, stop to complete
    [state] = resolveAction(state, { type: "stop", trainerId: "t0" });
    // Now in hub phase, skip free pick to advance to marketplace, then ready up
    expect(state.phase).toBe("hub");
    expect(state.hub!.phase).toBe("free_pick");
    [state] = resolveAction(state, { type: "skip_free_pick", trainerId: "t0" });
    expect(state.hub!.phase).toBe("marketplace");
    [state] = resolveAction(state, { type: "ready_up", trainerId: "t0" });
    expect(state.phase).toBe("world");
    // Now in world phase, vote to champ
    [state] = castVote(state, "t0", "champ");
    // Now in route phase at champion, stop to complete
    const [final, events] = resolveAction(state, { type: "stop", trainerId: "t0" });

    expect(final.phase).toBe("game_over");
    expect(events.some(e => e.type === "game_over")).toBe(true);
  });
});
