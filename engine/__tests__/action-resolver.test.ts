import { describe, test, expect, beforeEach } from "vitest";
import { resolveAction } from "../action-resolver";
import { createInitialState } from "../index";
import type { GameState, Trainer, RouteNode, RouteModifier, Pokemon } from "../types";
import { createPokemon } from "../pokemon/catalog";
import { createDeck } from "../models/deck";
import { getTrailPosition } from "../models/trail";

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
      expect(trainer.bustThreshold).toBe(0);
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
      expect(next.trainers["t1"].routeProgress.pokemonDrawn).toBe(0);
    });
  });

  // --- hit ---

  describe("hit", () => {
    test("draws a pokemon and updates progress", () => {
      const state = setupRoute(1);
      const [next, events] = hit(state, "t0");
      const trainer = next.trainers["t0"];

      expect(trainer.routeProgress.pokemonDrawn).toBe(1);
      expect(trainer.routeProgress.totalDistance).toBeGreaterThan(0);
      expect(trainer.routeProgress.totalCost).toBeGreaterThanOrEqual(0);
      expect(trainer.deck.drawn).toHaveLength(1);

      const drawEvent = events.find(e => e.type === "pokemon_drawn");
      expect(drawEvent).toBeDefined();
    });

    test("multiple hits accumulate distance and cost", () => {
      let state = setupRoute(1);
      [state] = hit(state, "t0");
      const after1 = state.trainers["t0"].routeProgress;

      [state] = hit(state, "t0");
      const after2 = state.trainers["t0"].routeProgress;

      expect(after2.pokemonDrawn).toBe(2);
      expect(after2.totalDistance).toBeGreaterThanOrEqual(after1.totalDistance);
      expect(after2.totalCost).toBeGreaterThanOrEqual(after1.totalCost);
    });

    test("busts when total cost exceeds threshold", () => {
      let state = setupRoute(1);
      const [finalState, busted] = hitUntilBust(state, "t0");

      // With starter deck (max cost 11, threshold 10), bust should be possible
      if (busted) {
        expect(finalState.trainers["t0"].status).toBe("busted");
        expect(finalState.trainers["t0"].routeProgress.totalCost).toBeGreaterThan(0);
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
        expect(bustEvent.totalCost).toBeGreaterThan(0);
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
    test("trainer earns VP from trail and currency on stop", () => {
      let state = setupRoute(2); // 2 trainers so stopping one doesn't end route
      [state] = hit(state, "t0");
      const distance = state.trainers["t0"].routeProgress.totalDistance;
      const trail = state.currentRoute!.trail;
      const expectedVP = trail.spots[getTrailPosition(trail, distance)].vp;

      [state] = stop(state, "t0");
      const trainer = state.trainers["t0"];

      expect(trainer.score).toBe(expectedVP);
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
      expect(trainer.routeProgress.pokemonDrawn).toBe(0);
    });

    test("moves drawn pokemon to discard", () => {
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
              pokemonDrawn: 3,
            },
          },
        },
      };
    }

    test("keep_score adds VP from trail to score, no currency", () => {
      let state = setupRoute(2);
      state = forceBust(state, "t0");
      const scoreBefore = state.trainers["t0"].score;
      const currencyBefore = state.trainers["t0"].currency;
      const trail = state.currentRoute!.trail;
      const expectedVP = trail.spots[getTrailPosition(trail, 7)].vp;

      [state] = bustPenalty(state, "t0", "keep_score");

      expect(state.trainers["t0"].score).toBe(scoreBefore + expectedVP);
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
      expect(state.phase).toBe("hub"); // both stopped → hub
      expect(state.currentRoute!.status).toBe("complete");
    });

    test("emits route_completed and hub_entered events", () => {
      let state = setupRoute(2);
      [state] = stop(state, "t0");
      const [, events] = stop(state, "t1");

      const routeCompleted = events.find(e => e.type === "route_completed");
      const hubEntered = events.find(e => e.type === "hub_entered");

      expect(routeCompleted).toBeDefined();
      expect(hubEntered).toBeDefined();
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
      expect(state.phase).toBe("hub");
    });

    test("single trainer stopping ends route immediately", () => {
      let state = setupRoute(1);
      [state] = stop(state, "t0");

      expect(state.phase).toBe("hub");
      expect(state.currentRoute!.status).toBe("complete");
    });

    test("hub state is set on route completion", () => {
      let state = setupRoute(1);
      [state] = stop(state, "t0");

      expect(state.hub).not.toBeNull();
    });

    test("scores persist across route completion", () => {
      let state = setupRoute(1);
      [state] = hit(state, "t0");
      const distance = state.trainers["t0"].routeProgress.totalDistance;
      const trail = state.currentRoute!.trail;
      const expectedVP = trail.spots[getTrailPosition(trail, distance)].vp;
      [state] = stop(state, "t0");

      expect(state.trainers["t0"].score).toBe(expectedVP);
    });
  });

  // --- Route → Hub transition ---

  describe("route → hub transition", () => {
    test("route completion transitions to hub instead of world", () => {
      let state = setupRoute(1);
      [state] = stop(state, "t0");

      expect(state.phase).toBe("hub");
      expect(state.hub).not.toBeNull();
    });

    test("hub has free pick offers for non-busted trainer", () => {
      let state = setupRoute(1);
      [state] = stop(state, "t0");

      expect(state.hub!.freePickOffers["t0"]).toBeDefined();
    });

    test("champion route still goes straight to game_over", () => {
      let state = setupRoute(1);
      const champNode: RouteNode = {
        id: "champ", type: "champion", bonus: null, name: "Champion", tier: 7,
        connections: [], bustThreshold: 5, modifiers: [], visited: true, pokemonPool: [],
      };
      state = {
        ...state,
        map: { nodes: { champ: champNode }, currentNodeId: "champ", totalTiers: 8 },
      };
      [state] = stop(state, "t0");

      expect(state.phase).toBe("game_over");
    });
  });

  // --- per-route bust threshold ---

  describe("per-route bust threshold", () => {
    test("trainer bustThreshold is set from route node on game start", () => {
      const state = setupRoute(1);
      const trainer = Object.values(state.trainers)[0];
      // Start node has bustThreshold 8
      expect(trainer.bustThreshold).toBe(8);
    });
  });

  // --- end_of_round and bonus_currency ---

  describe("end_of_round and bonus_currency", () => {
    test("bonus_currency from end_of_round is added when trainer stops", () => {
      let state = lobby();
      [state] = join(state, "Ash", "t0");
      [state] = start(state, "t0");

      // Replace trainer's deck with Meowth-only deck
      const meowth = createPokemon("meowth");
      state = {
        ...state,
        trainers: {
          ...state.trainers,
          t0: {
            ...state.trainers.t0,
            deck: createDeck([meowth, meowth, meowth].map((p, i) => ({ ...p, id: `m${i}` }))),
          },
        },
      };

      // Draw one meowth
      [state] = hit(state, "t0");
      // Stop — end_of_round should fire Meowth's Pay Day (+1 currency)
      const [finalState] = stop(state, "t0");
      const trainer = finalState.trainers.t0;
      // Base currency: floor(2/3) = 0, plus bonus_currency: 1
      expect(trainer.currency).toBe(1);
    });

    test("bonus_currency from end_of_round is included in bust keep_currency choice", () => {
      let state = lobby();
      [state] = join(state, "Ash", "t0");
      [state] = start(state, "t0");

      const meowth = { ...createPokemon("meowth"), id: "m0" };
      const heavy = { ...createPokemon("machop"), id: "heavy1", cost: 20, distance: 5 };
      // Set drawPile directly to control draw order (meowth first, then heavy)
      state = {
        ...state,
        trainers: {
          ...state.trainers,
          t0: {
            ...state.trainers.t0,
            deck: { drawPile: [meowth, heavy], drawn: [], discard: [] },
          },
        },
      };

      [state] = hit(state, "t0"); // meowth (cost 1, safe)
      [state] = hit(state, "t0"); // heavy (cost 20, busts)
      expect(state.trainers.t0.status).toBe("busted");

      const [finalState] = bustPenalty(state, "t0", "keep_currency");
      const trainer = finalState.trainers.t0;
      // distance = 2 + 5 = 7, base currency = floor(7/3) = 2, bonus = 1 from meowth
      expect(trainer.currency).toBe(3);
    });

    test("bonus_currency is lost when bust and keep_score", () => {
      let state = lobby();
      [state] = join(state, "Ash", "t0");
      [state] = start(state, "t0");

      const meowth = { ...createPokemon("meowth"), id: "m0" };
      const heavy = { ...createPokemon("machop"), id: "heavy1", cost: 20, distance: 5 };
      state = {
        ...state,
        trainers: {
          ...state.trainers,
          t0: {
            ...state.trainers.t0,
            deck: { drawPile: [meowth, heavy], drawn: [], discard: [] },
          },
        },
      };

      [state] = hit(state, "t0");
      [state] = hit(state, "t0");
      const [finalState] = bustPenalty(state, "t0", "keep_score");
      expect(finalState.trainers.t0.currency).toBe(0);
    });
  });

  // --- Route modifiers ---

  describe("route modifiers", () => {
    function setupWithModifiers(modifiers: RouteModifier[]): GameState {
      let state = setupRoute(1);
      state = {
        ...state,
        currentRoute: { ...state.currentRoute!, modifiers },
      };
      return state;
    }

    test("distance_bonus modifier adds to all draws", () => {
      let state = setupWithModifiers([
        { id: "test", description: "test", type: "distance_bonus", value: 2 },
      ]);
      const trainerId = Object.keys(state.trainers)[0];
      const [newState, events] = hit(state, trainerId);
      const drawnEvent = events.find(e => e.type === "pokemon_drawn");
      expect(drawnEvent).toBeDefined();
      if (drawnEvent?.type === "pokemon_drawn") {
        expect(drawnEvent.progress.totalDistance).toBeGreaterThanOrEqual(2);
      }
    });

    test("cost_bonus modifier increases cost", () => {
      let state = setupWithModifiers([
        { id: "test", description: "test", type: "cost_bonus", value: 1 },
      ]);
      const trainerId = Object.keys(state.trainers)[0];
      const magikarp = createPokemon("magikarp");
      state = {
        ...state,
        trainers: {
          ...state.trainers,
          [trainerId]: {
            ...state.trainers[trainerId],
            deck: createDeck([{ ...magikarp, id: "mk1" }, { ...magikarp, id: "mk2" }]),
          },
        },
      };
      const [newState] = hit(state, trainerId);
      expect(newState.trainers[trainerId].routeProgress.totalCost).toBe(1);
    });

    test("type_bonus modifier adds distance for matching type", () => {
      let state = setupWithModifiers([
        { id: "test", description: "test", type: "type_bonus", value: 3, targetType: "fire" },
      ]);
      const trainerId = Object.keys(state.trainers)[0];
      const charmander = createPokemon("charmander");
      state = {
        ...state,
        trainers: {
          ...state.trainers,
          [trainerId]: {
            ...state.trainers[trainerId],
            deck: createDeck([{ ...charmander, id: "c1" }]),
          },
        },
      };
      const [newState] = hit(state, trainerId);
      expect(newState.trainers[trainerId].routeProgress.totalDistance).toBe(6);
    });

    test("type_bonus modifier does not apply to non-matching type", () => {
      let state = setupWithModifiers([
        { id: "test", description: "test", type: "type_bonus", value: 3, targetType: "fire" },
      ]);
      const trainerId = Object.keys(state.trainers)[0];
      const magikarp = createPokemon("magikarp"); // water type
      state = {
        ...state,
        trainers: {
          ...state.trainers,
          [trainerId]: {
            ...state.trainers[trainerId],
            deck: createDeck([{ ...magikarp, id: "mk1" }]),
          },
        },
      };
      const [newState] = hit(state, trainerId);
      // magikarp: water type, distance 0, cost 0 — no fire bonus
      expect(newState.trainers[trainerId].routeProgress.totalDistance).toBe(0);
    });

    test("threshold_modifier affects bust calculation", () => {
      let state = setupWithModifiers([
        { id: "test", description: "test", type: "threshold_modifier", value: -3 },
      ]);
      const trainerId = Object.keys(state.trainers)[0];
      const heavy: Pokemon = {
        id: "h1", templateId: "test", name: "Heavy",
        types: ["normal"], distance: 1, cost: 6, rarity: "common",
        description: "", moves: [],
      };
      state = {
        ...state,
        trainers: {
          ...state.trainers,
          [trainerId]: {
            ...state.trainers[trainerId],
            deck: createDeck([heavy]),
          },
        },
      };
      const [newState] = hit(state, trainerId);
      // threshold 8 - 3 = 5, cost 6 > 5, should bust
      expect(newState.trainers[trainerId].status).toBe("busted");
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
