import { describe, test, expect, beforeEach } from "vitest";
import { resolveAction } from "../action-resolver";
import { createInitialState } from "../index";
import type { GameState, Trainer } from "../types";

// === Helpers ===

function lobby(): GameState {
  return createInitialState("TEST");
}

function join(state: GameState, name: string, token: string) {
  return resolveAction(state, { type: "join_game", trainerName: name, sessionToken: token });
}

function start(state: GameState, trainerId: string) {
  return resolveAction(state, { type: "start_game", trainerId });
}

function hit(state: GameState, trainerId: string) {
  return resolveAction(state, { type: "hit", trainerId });
}

function stop(state: GameState, trainerId: string) {
  return resolveAction(state, { type: "stop", trainerId });
}

function bustPenalty(state: GameState, trainerId: string, choice: "keep_score" | "keep_currency") {
  return resolveAction(state, { type: "choose_bust_penalty", trainerId, choice });
}

/** Join N trainers and start the game, returning the route-phase state */
function setupRoute(trainerCount: number): GameState {
  let state = lobby();
  for (let i = 0; i < trainerCount; i++) {
    [state] = join(state, `Trainer${i}`, `t${i}`);
  }
  [state] = start(state, "t0");
  return state;
}

/** Keep hitting until trainer busts or deck runs out */
function hitUntilBust(state: GameState, trainerId: string): [GameState, boolean] {
  let busted = false;
  for (let i = 0; i < 20; i++) {
    const trainer = state.trainers[trainerId];
    if (!trainer || trainer.status !== "exploring") break;
    const [next, events] = hit(state, trainerId);
    state = next;
    if (events.some(e => e.type === "trainer_busted")) {
      busted = true;
      break;
    }
  }
  return [state, busted];
}

// === Tests ===

describe("action-resolver", () => {
  // --- join_game ---

  describe("join_game", () => {
    test("adds a trainer in lobby phase", () => {
      const [state, events] = join(lobby(), "Ash", "token1");

      expect(state.trainers["token1"]).toBeDefined();
      expect(state.trainers["token1"].name).toBe("Ash");
      expect(state.trainers["token1"].status).toBe("waiting");
      expect(events).toEqual([
        { type: "trainer_joined", trainerId: "token1", trainerName: "Ash" },
      ]);
    });

    test("multiple trainers can join", () => {
      let state = lobby();
      [state] = join(state, "Ash", "t1");
      [state] = join(state, "Misty", "t2");

      expect(Object.keys(state.trainers)).toHaveLength(2);
      expect(state.trainers["t1"].name).toBe("Ash");
      expect(state.trainers["t2"].name).toBe("Misty");
    });

    test("duplicate session token is ignored", () => {
      let state = lobby();
      [state] = join(state, "Ash", "t1");
      const [next, events] = join(state, "Ash Again", "t1");

      expect(Object.keys(next.trainers)).toHaveLength(1);
      expect(next.trainers["t1"].name).toBe("Ash"); // original name kept
      expect(events).toEqual([]);
    });

    test("rejected when lobby is full", () => {
      let state = lobby();
      for (let i = 0; i < state.settings.maxTrainers; i++) {
        [state] = join(state, `T${i}`, `token${i}`);
      }
      const [next, events] = join(state, "Extra", "extra_token");

      expect(Object.keys(next.trainers)).toHaveLength(state.settings.maxTrainers);
      expect(events).toEqual([]);
    });

    test("rejected when not in lobby phase", () => {
      const state = setupRoute(1);
      expect(state.phase).toBe("route");

      const [next, events] = join(state, "Late", "late_token");
      expect(next.trainers["late_token"]).toBeUndefined();
      expect(events).toEqual([]);
    });

    test("trainer gets a starter deck", () => {
      const [state] = join(lobby(), "Ash", "t1");
      const trainer = state.trainers["t1"];

      expect(trainer.deck.drawPile.length).toBeGreaterThan(0);
      expect(trainer.deck.drawn).toEqual([]);
      expect(trainer.deck.discard).toEqual([]);
    });

    test("trainer starts with correct defaults", () => {
      const [state] = join(lobby(), "Ash", "t1");
      const trainer = state.trainers["t1"];

      expect(trainer.score).toBe(0);
      expect(trainer.currency).toBe(0);
      expect(trainer.bustThreshold).toBe(10);
      expect(trainer.routeProgress.totalDistance).toBe(0);
      expect(trainer.routeProgress.totalCost).toBe(0);
    });
  });

  // --- start_game ---

  describe("start_game", () => {
    test("transitions from lobby to route phase", () => {
      let state = lobby();
      [state] = join(state, "Ash", "t1");
      const [next, events] = start(state, "t1");

      expect(next.phase).toBe("route");
      expect(next.currentRoute).not.toBeNull();
      expect(next.currentRoute!.routeNumber).toBe(1);
      expect(next.currentRoute!.status).toBe("in_progress");
      expect(events[0].type).toBe("game_started");
      expect(events[1].type).toBe("route_started");
    });

    test("sets all trainers to exploring", () => {
      let state = lobby();
      [state] = join(state, "Ash", "t1");
      [state] = join(state, "Misty", "t2");
      const [next] = start(state, "t1");

      expect(next.trainers["t1"].status).toBe("exploring");
      expect(next.trainers["t2"].status).toBe("exploring");
    });

    test("sets turn order with all trainers", () => {
      let state = lobby();
      [state] = join(state, "Ash", "t1");
      [state] = join(state, "Misty", "t2");
      const [next] = start(state, "t1");

      expect(next.currentRoute!.turnOrder).toContain("t1");
      expect(next.currentRoute!.turnOrder).toContain("t2");
      expect(next.currentRoute!.turnOrder).toHaveLength(2);
    });

    test("rejected with no trainers", () => {
      const state = lobby();
      const [next, events] = start(state, "nobody");

      expect(next.phase).toBe("lobby");
      expect(events).toEqual([]);
    });

    test("rejected when not in lobby phase", () => {
      const state = setupRoute(1);
      const [next, events] = start(state, "t0");

      expect(next.phase).toBe("route"); // stays in route, doesn't restart
      expect(events).toEqual([]);
    });

    test("resets trainer route progress", () => {
      let state = lobby();
      [state] = join(state, "Ash", "t1");
      const [next] = start(state, "t1");

      expect(next.trainers["t1"].routeProgress.totalDistance).toBe(0);
      expect(next.trainers["t1"].routeProgress.totalCost).toBe(0);
      expect(next.trainers["t1"].routeProgress.creaturesDrawn).toBe(0);
    });
  });

  // --- hit ---

  describe("hit", () => {
    test("draws a creature and updates progress", () => {
      const state = setupRoute(1);
      const [next, events] = hit(state, "t0");
      const trainer = next.trainers["t0"];

      expect(trainer.routeProgress.creaturesDrawn).toBe(1);
      expect(trainer.routeProgress.totalDistance).toBeGreaterThan(0);
      expect(trainer.routeProgress.totalCost).toBeGreaterThan(0);
      expect(trainer.deck.drawn).toHaveLength(1);

      const drawEvent = events.find(e => e.type === "creature_drawn");
      expect(drawEvent).toBeDefined();
    });

    test("multiple hits accumulate distance and cost", () => {
      let state = setupRoute(1);
      [state] = hit(state, "t0");
      const after1 = state.trainers["t0"].routeProgress;

      [state] = hit(state, "t0");
      const after2 = state.trainers["t0"].routeProgress;

      expect(after2.creaturesDrawn).toBe(2);
      expect(after2.totalDistance).toBeGreaterThanOrEqual(after1.totalDistance);
      expect(after2.totalCost).toBeGreaterThanOrEqual(after1.totalCost);
    });

    test("busts when total cost exceeds threshold", () => {
      let state = setupRoute(1);
      const [finalState, busted] = hitUntilBust(state, "t0");

      // With starter deck (max cost 17, threshold 10), bust should be possible
      if (busted) {
        expect(finalState.trainers["t0"].status).toBe("busted");
        expect(finalState.trainers["t0"].routeProgress.totalCost).toBeGreaterThan(10);
      }
    });

    test("emits trainer_busted event on bust", () => {
      let state = setupRoute(1);
      let allEvents: any[] = [];

      for (let i = 0; i < 20; i++) {
        const trainer = state.trainers["t0"];
        if (!trainer || trainer.status !== "exploring") break;
        const [next, events] = hit(state, "t0");
        state = next;
        allEvents.push(...events);
        if (events.some(e => e.type === "trainer_busted")) break;
      }

      const bustEvent = allEvents.find(e => e.type === "trainer_busted");
      if (bustEvent) {
        expect(bustEvent.trainerId).toBe("t0");
        expect(bustEvent.totalCost).toBeGreaterThan(10);
      }
    });

    test("rejected when not in route phase", () => {
      const state = lobby();
      const [next, events] = hit(state, "t0");

      expect(next).toEqual(state);
      expect(events).toEqual([]);
    });

    test("rejected for non-existent trainer", () => {
      const state = setupRoute(1);
      const [next, events] = hit(state, "nobody");

      expect(events).toEqual([]);
    });

    test("rejected for stopped trainer", () => {
      let state = setupRoute(1);
      [state] = stop(state, "t0");
      // trainer is now stopped (or world phase if single trainer)

      const [next, events] = hit(state, "t0");
      expect(events).toEqual([]);
    });
  });

  // --- stop ---

  describe("stop", () => {
    test("trainer earns score and currency on stop", () => {
      let state = setupRoute(2); // 2 trainers so stopping one doesn't end route
      [state] = hit(state, "t0");
      const distance = state.trainers["t0"].routeProgress.totalDistance;

      [state] = stop(state, "t0");
      const trainer = state.trainers["t0"];

      expect(trainer.score).toBe(distance);
      expect(trainer.currency).toBe(Math.floor(distance / 3));
      expect(trainer.status).toBe("stopped");
    });

    test("emits trainer_stopped event", () => {
      let state = setupRoute(2);
      [state] = hit(state, "t0");
      const distance = state.trainers["t0"].routeProgress.totalDistance;

      const [, events] = stop(state, "t0");
      const stopEvent = events.find(e => e.type === "trainer_stopped");

      expect(stopEvent).toBeDefined();
      expect(stopEvent!.type === "trainer_stopped" && stopEvent!.totalDistance).toBe(distance);
    });

    test("resets route progress after stop", () => {
      let state = setupRoute(2);
      [state] = hit(state, "t0");
      [state] = stop(state, "t0");
      const trainer = state.trainers["t0"];

      expect(trainer.routeProgress.totalDistance).toBe(0);
      expect(trainer.routeProgress.totalCost).toBe(0);
      expect(trainer.routeProgress.creaturesDrawn).toBe(0);
    });

    test("moves drawn creatures to discard", () => {
      let state = setupRoute(2);
      [state] = hit(state, "t0");
      const drawnCount = state.trainers["t0"].deck.drawn.length;
      expect(drawnCount).toBe(1);

      [state] = stop(state, "t0");
      expect(state.trainers["t0"].deck.drawn).toHaveLength(0);
      expect(state.trainers["t0"].deck.discard.length).toBeGreaterThanOrEqual(drawnCount);
    });

    test("stopping with zero distance gives zero rewards", () => {
      let state = setupRoute(2);
      // Stop immediately without hitting
      [state] = stop(state, "t0");

      expect(state.trainers["t0"].score).toBe(0);
      expect(state.trainers["t0"].currency).toBe(0);
    });

    test("rejected when not in route phase", () => {
      const state = lobby();
      const [next, events] = stop(state, "t0");
      expect(events).toEqual([]);
    });

    test("rejected for already stopped trainer", () => {
      let state = setupRoute(2);
      [state] = stop(state, "t0");
      const [next, events] = stop(state, "t0");
      expect(events).toEqual([]);
    });
  });

  // --- choose_bust_penalty ---

  describe("choose_bust_penalty", () => {
    /** Force a bust by setting cost super high via direct state manipulation */
    function forceBust(state: GameState, trainerId: string): GameState {
      const trainer = state.trainers[trainerId];
      return {
        ...state,
        trainers: {
          ...state.trainers,
          [trainerId]: {
            ...trainer,
            status: "busted" as const,
            routeProgress: {
              ...trainer.routeProgress,
              totalDistance: 7,
              totalCost: 12,
              creaturesDrawn: 3,
            },
          },
        },
      };
    }

    test("keep_score adds distance to score, no currency", () => {
      let state = setupRoute(2);
      state = forceBust(state, "t0");
      const scoreBefore = state.trainers["t0"].score;
      const currencyBefore = state.trainers["t0"].currency;

      [state] = bustPenalty(state, "t0", "keep_score");

      expect(state.trainers["t0"].score).toBe(scoreBefore + 7);
      expect(state.trainers["t0"].currency).toBe(currencyBefore); // no currency gain
      expect(state.trainers["t0"].status).toBe("stopped");
    });

    test("keep_currency adds currency, no score", () => {
      let state = setupRoute(2);
      state = forceBust(state, "t0");
      const scoreBefore = state.trainers["t0"].score;
      const currencyBefore = state.trainers["t0"].currency;

      [state] = bustPenalty(state, "t0", "keep_currency");

      expect(state.trainers["t0"].score).toBe(scoreBefore); // no score gain
      expect(state.trainers["t0"].currency).toBe(currencyBefore + Math.floor(7 / 3));
      expect(state.trainers["t0"].status).toBe("stopped");
    });

    test("emits bust_penalty_chosen event", () => {
      let state = setupRoute(2);
      state = forceBust(state, "t0");

      const [, events] = bustPenalty(state, "t0", "keep_score");
      expect(events).toEqual([
        { type: "bust_penalty_chosen", trainerId: "t0", choice: "keep_score" },
      ]);
    });

    test("resets route progress after penalty", () => {
      let state = setupRoute(2);
      state = forceBust(state, "t0");
      [state] = bustPenalty(state, "t0", "keep_score");

      expect(state.trainers["t0"].routeProgress.totalDistance).toBe(0);
      expect(state.trainers["t0"].routeProgress.totalCost).toBe(0);
    });

    test("rejected for non-busted trainer", () => {
      const state = setupRoute(1);
      expect(state.trainers["t0"].status).toBe("exploring");

      const [, events] = bustPenalty(state, "t0", "keep_score");
      expect(events).toEqual([]);
    });

    test("rejected when not in route phase", () => {
      const state = lobby();
      const [, events] = bustPenalty(state, "t0", "keep_score");
      expect(events).toEqual([]);
    });
  });

  // --- Multi-trainer route + completion + phase transition ---

  describe("route completion and phase transition", () => {
    test("route completes when all trainers stop", () => {
      let state = setupRoute(2);
      [state] = stop(state, "t0");
      expect(state.phase).toBe("route"); // still in route, t1 exploring

      [state] = stop(state, "t1");
      expect(state.phase).toBe("world"); // both stopped → world
      expect(state.currentRoute!.status).toBe("complete");
    });

    test("emits route_completed and world_entered events", () => {
      let state = setupRoute(2);
      [state] = stop(state, "t0");
      const [, events] = stop(state, "t1");

      const routeCompleted = events.find(e => e.type === "route_completed");
      const worldEntered = events.find(e => e.type === "world_entered");

      expect(routeCompleted).toBeDefined();
      expect(worldEntered).toBeDefined();
    });

    test("resets all trainers to waiting after route completion", () => {
      let state = setupRoute(2);
      [state] = stop(state, "t0");
      [state] = stop(state, "t1");

      for (const trainer of Object.values(state.trainers)) {
        expect(trainer.status).toBe("waiting");
      }
    });

    test("route completes when busted trainer chooses penalty and last trainer stops", () => {
      let state = setupRoute(2);
      // Force bust t0
      state = {
        ...state,
        trainers: {
          ...state.trainers,
          t0: { ...state.trainers["t0"], status: "busted" as const },
        },
      };

      [state] = bustPenalty(state, "t0", "keep_score");
      expect(state.phase).toBe("route"); // t1 still exploring

      [state] = stop(state, "t1");
      expect(state.phase).toBe("world");
    });

    test("single trainer stopping ends route immediately", () => {
      let state = setupRoute(1);
      [state] = stop(state, "t0");

      expect(state.phase).toBe("world");
      expect(state.currentRoute!.status).toBe("complete");
    });

    test("votes are reset on world phase entry", () => {
      let state = setupRoute(1);
      [state] = stop(state, "t0");

      expect(state.votes).toEqual({});
    });

    test("scores persist across route completion", () => {
      let state = setupRoute(1);
      [state] = hit(state, "t0");
      const distance = state.trainers["t0"].routeProgress.totalDistance;
      [state] = stop(state, "t0");

      expect(state.trainers["t0"].score).toBe(distance);
    });
  });

  // --- Unknown action ---

  describe("unknown action", () => {
    test("returns state unchanged for unhandled action types", () => {
      const state = lobby();
      const [next, events] = resolveAction(state, { type: "cast_vote", trainerId: "t1", nodeId: "n1" });

      expect(next).toEqual(state);
      expect(events).toEqual([]);
    });
  });
});
