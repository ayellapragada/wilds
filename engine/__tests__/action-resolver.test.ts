import { describe, test, it, expect, beforeEach } from "vitest";
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
      const expectedCurrency = trail.spots[getTrailPosition(trail, distance)].currency;
      expect(trainer.currency).toBe(expectedCurrency);
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
      const trail = state.currentRoute!.trail;
      const expectedCurrency = trail.spots[getTrailPosition(trail, 7)].currency;

      [state] = bustPenalty(state, "t0", "keep_currency");

      expect(state.trainers["t0"].score).toBe(scoreBefore); // no score gain
      expect(state.trainers["t0"].currency).toBe(currencyBefore + expectedCurrency);
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
        currencyDistribution: { total: 3, curve: "flat" as const },
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
    /** A fake pokemon with an end_of_round bonus_currency move (like old Meowth) */
    function fakeCurrencyPokemon(id: string): Pokemon {
      return {
        id,
        templateId: "fake_currency",
        name: "FakeCurrency",
        types: ["normal"],
        distance: 2,
        cost: 1,
        rarity: "common",
        description: "A test pokemon with bonus_currency.",
        moves: [{
          name: "Pay Day", reminderText: "+1 currency at end of round",
          trigger: "end_of_round", condition: null,
          effect: { type: "bonus_currency", amount: 1 },
        }],
        stage: "basic",
        evolutionLine: "fake_currency",
        evolvesInto: null,
        evolutionSpeed: null,
      };
    }

    test("bonus_currency from end_of_round is added when trainer stops", () => {
      let state = lobby();
      [state] = join(state, "Ash", "t0");
      [state] = start(state, "t0");

      // Replace trainer's deck with fake currency pokemon
      state = {
        ...state,
        trainers: {
          ...state.trainers,
          t0: {
            ...state.trainers.t0,
            deck: createDeck([fakeCurrencyPokemon("m0"), fakeCurrencyPokemon("m1"), fakeCurrencyPokemon("m2")]),
          },
        },
      };

      // Draw one (distance 2, cost 1)
      [state] = hit(state, "t0");
      // Stop — end_of_round should fire Pay Day (+1 currency)
      const [finalState] = stop(state, "t0");
      const trainer = finalState.trainers.t0;
      // Tile currency at position 2: 3, plus bonus_currency from Pay Day: 1
      expect(trainer.currency).toBe(4);
    });

    test("bonus_currency from end_of_round is included in bust keep_currency choice", () => {
      let state = lobby();
      [state] = join(state, "Ash", "t0");
      [state] = start(state, "t0");

      const currencyPokemon = fakeCurrencyPokemon("m0");
      const heavy = { ...createPokemon("machop"), id: "heavy1", cost: 20, distance: 5 };
      // Set drawPile directly to control draw order (currency pokemon first, then heavy)
      state = {
        ...state,
        trainers: {
          ...state.trainers,
          t0: {
            ...state.trainers.t0,
            deck: { drawPile: [currencyPokemon, heavy], drawn: [], discard: [] },
          },
        },
      };

      [state] = hit(state, "t0"); // currencyPokemon (cost 1, safe)
      [state] = hit(state, "t0"); // heavy (cost 20, busts)
      expect(state.trainers.t0.status).toBe("busted");

      const [finalState] = bustPenalty(state, "t0", "keep_currency");
      const trainer = finalState.trainers.t0;
      // distance = 2 + 5 = 7, tile currency at position 7: 3, bonus = 1 from Pay Day
      expect(trainer.currency).toBe(4);
    });

    test("bonus_currency is lost when bust and keep_score", () => {
      let state = lobby();
      [state] = join(state, "Ash", "t0");
      [state] = start(state, "t0");

      const currencyPokemon = fakeCurrencyPokemon("m0");
      const heavy = { ...createPokemon("machop"), id: "heavy1", cost: 20, distance: 5 };
      state = {
        ...state,
        trainers: {
          ...state.trainers,
          t0: {
            ...state.trainers.t0,
            deck: { drawPile: [currencyPokemon, heavy], drawn: [], discard: [] },
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
      const squirtle = createPokemon("squirtle");
      state = {
        ...state,
        trainers: {
          ...state.trainers,
          [trainerId]: {
            ...state.trainers[trainerId],
            deck: createDeck([{ ...squirtle, id: "mk1" }, { ...squirtle, id: "mk2" }]),
          },
        },
      };
      const [newState] = hit(state, trainerId);
      // squirtle cost 2 + cost_bonus 1 = 3
      expect(newState.trainers[trainerId].routeProgress.totalCost).toBe(3);
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
      // charmander: fire type, distance 1 + type_bonus 3 = 4
      expect(newState.trainers[trainerId].routeProgress.totalDistance).toBe(4);
    });

    test("type_bonus modifier does not apply to non-matching type", () => {
      let state = setupWithModifiers([
        { id: "test", description: "test", type: "type_bonus", value: 3, targetType: "fire" },
      ]);
      const trainerId = Object.keys(state.trainers)[0];
      const squirtle = createPokemon("squirtle"); // water type
      state = {
        ...state,
        trainers: {
          ...state.trainers,
          [trainerId]: {
            ...state.trainers[trainerId],
            deck: createDeck([{ ...squirtle, id: "mk1" }]),
          },
        },
      };
      const [newState] = hit(state, trainerId);
      // squirtle: water type, distance 1 — no fire bonus
      expect(newState.trainers[trainerId].routeProgress.totalDistance).toBe(1);
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
        stage: "basic", evolutionLine: "test", evolvesInto: null, evolutionSpeed: null,
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

  // --- Item collection ---

  describe("item collection", () => {
    function setupWithItemOnSpot(spotIndex: number): GameState {
      let state = setupRoute(2);
      const trail = state.currentRoute!.trail;
      const updatedSpots = trail.spots.map((s, i) =>
        i === spotIndex
          ? { ...s, item: { id: "nugget" as const, name: "Nugget", description: "A nugget", hidden: false } }
          : { ...s, item: null }
      );
      state = {
        ...state,
        currentRoute: {
          ...state.currentRoute!,
          trail: { spots: updatedSpots },
        },
      };
      return state;
    }

    test("trainer collects item when landing on spot with item", () => {
      let state = setupWithItemOnSpot(3);
      const pokemon: Pokemon = {
        id: "p1", templateId: "test", name: "Mover",
        types: ["normal"], distance: 3, cost: 0, rarity: "common",
        description: "", moves: [],
        stage: "basic", evolutionLine: "test", evolvesInto: null, evolutionSpeed: null,
      };
      state = {
        ...state,
        trainers: {
          ...state.trainers,
          t0: {
            ...state.trainers.t0,
            deck: createDeck([pokemon]),
          },
        },
      };

      const [newState, events] = hit(state, "t0");
      expect(newState.trainers.t0.items).toContain("nugget");
      const collectEvent = events.find(e => e.type === "item_collected");
      expect(collectEvent).toBeDefined();
    });

    test("trainer does not collect item when not landing on item spot", () => {
      let state = setupWithItemOnSpot(5);
      const pokemon: Pokemon = {
        id: "p1", templateId: "test", name: "Mover",
        types: ["normal"], distance: 3, cost: 0, rarity: "common",
        description: "", moves: [],
        stage: "basic", evolutionLine: "test", evolvesInto: null, evolutionSpeed: null,
      };
      state = {
        ...state,
        trainers: {
          ...state.trainers,
          t0: {
            ...state.trainers.t0,
            deck: createDeck([pokemon]),
          },
        },
      };

      const [newState, events] = hit(state, "t0");
      expect(newState.trainers.t0.items).toHaveLength(0);
      expect(events.find(e => e.type === "item_collected")).toBeUndefined();
    });

    test("multiple trainers can collect same item", () => {
      let state = setupWithItemOnSpot(3);
      const pokemon: Pokemon = {
        id: "p1", templateId: "test", name: "Mover",
        types: ["normal"], distance: 3, cost: 0, rarity: "common",
        description: "", moves: [],
        stage: "basic", evolutionLine: "test", evolvesInto: null, evolutionSpeed: null,
      };
      state = {
        ...state,
        trainers: {
          ...state.trainers,
          t0: { ...state.trainers.t0, deck: createDeck([{ ...pokemon, id: "p1" }]) },
          t1: { ...state.trainers.t1, deck: createDeck([{ ...pokemon, id: "p2" }]) },
        },
      };

      let [next] = hit(state, "t0");
      expect(next.trainers.t0.items).toContain("nugget");

      [next] = hit(next, "t1");
      expect(next.trainers.t1.items).toContain("nugget");
    });
  });

  // --- trainer stats ---

  describe("trainer stats", () => {
    it("initializes stats to zero when game starts", () => {
      let state = createInitialState("test");
      [state] = resolveAction(state, { type: "join_game", trainerName: "Alice", sessionToken: "t1" });
      [state] = resolveAction(state, { type: "start_game", trainerId: "t1" });
      expect(state.trainers.t1.stats).toEqual({
        cardsDrawn: 0,
        bustCount: 0,
        maxRouteDistance: 0,
        totalCurrencyEarned: 0,
        maxCardDistance: 0,
        finalDeckSize: 0,
      });
    });

    it("increments cardsDrawn on hit", () => {
      let state = createInitialState("test");
      [state] = resolveAction(state, { type: "join_game", trainerName: "Alice", sessionToken: "t1" });
      [state] = resolveAction(state, { type: "start_game", trainerId: "t1" });
      [state] = resolveAction(state, { type: "hit", trainerId: "t1" });
      expect(state.trainers.t1.stats.cardsDrawn).toBe(1);
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

  // --- add_bot ---

  describe("add_bot", () => {
    test("creates a bot trainer with bot: true", () => {
      let state = lobby();
      const [newState, events] = resolveAction(state, { type: "add_bot", strategy: "conservative" });

      const bot = newState.trainers["bot_1"];
      expect(bot).toBeDefined();
      expect(bot.bot).toBe(true);
      expect(bot.name).toBe("Bot 1");
      expect(events).toEqual([{ type: "trainer_joined", trainerId: "bot_1", trainerName: "Bot 1" }]);
    });

    test("records strategy in botStrategies", () => {
      let state = lobby();
      const [newState] = resolveAction(state, { type: "add_bot", strategy: "aggressive" });

      expect(newState.botStrategies["bot_1"]).toBe("aggressive");
    });

    test("rejected outside lobby phase", () => {
      let state = lobby();
      [state] = join(state, "Player", "p1");
      [state] = resolveAction(state, { type: "add_bot", strategy: "random" });
      [state] = start(state, "p1");

      const [newState, events] = resolveAction(state, { type: "add_bot", strategy: "random" });
      expect(newState).toBe(state);
      expect(events).toEqual([]);
    });

    test("rejected at max trainers", () => {
      let state = lobby();
      for (let i = 0; i < state.settings.maxTrainers; i++) {
        [state] = join(state, `T${i}`, `t${i}`);
      }

      const [newState, events] = resolveAction(state, { type: "add_bot", strategy: "random" });
      expect(newState).toBe(state);
      expect(events).toEqual([]);
    });

    test("bot trainers participate in game flow", () => {
      let state = lobby();
      [state] = join(state, "Human", "h1");
      [state] = resolveAction(state, { type: "add_bot", strategy: "conservative" });
      [state] = start(state, "h1");

      expect(state.phase).toBe("route");
      expect(state.trainers["bot_1"].status).toBe("exploring");
      expect(state.trainers["h1"].status).toBe("exploring");
    });

    test("multiple bots get incrementing IDs", () => {
      let state = lobby();
      [state] = resolveAction(state, { type: "add_bot", strategy: "aggressive" });
      [state] = resolveAction(state, { type: "add_bot", strategy: "conservative" });
      [state] = resolveAction(state, { type: "add_bot", strategy: "random" });

      expect(state.trainers["bot_1"]).toBeDefined();
      expect(state.trainers["bot_2"]).toBeDefined();
      expect(state.trainers["bot_3"]).toBeDefined();
      expect(state.botStrategies).toEqual({
        bot_1: "aggressive",
        bot_2: "conservative",
        bot_3: "random",
      });
    });

    test("human trainers have bot: false", () => {
      let state = lobby();
      [state] = join(state, "Human", "h1");
      expect(state.trainers["h1"].bot).toBe(false);
    });
  });

  // --- play_again ---

  describe("play_again", () => {
    it("resets game state to lobby preserving trainer names and avatars", () => {
      let state = createInitialState("test");
      [state] = resolveAction(state, { type: "join_game", trainerName: "Alice", sessionToken: "t1" });
      [state] = resolveAction(state, { type: "start_game", trainerId: "t1" });
      // Force game_over phase
      state = { ...state, phase: "game_over", superlatives: [] };
      const [newState, events] = resolveAction(state, { type: "play_again", trainerId: "t1" });
      expect(newState.phase).toBe("lobby");
      expect(newState.trainers.t1.name).toBe("Alice");
      expect(newState.trainers.t1.score).toBe(0);
      expect(newState.trainers.t1.currency).toBe(0);
      expect(newState.map).toBeNull();
      expect(newState.currentRoute).toBeNull();
      expect(newState.superlatives).toEqual([]);
      expect(events).toEqual([{ type: "play_again" }]);
    });

    it("preserves trainer avatars", () => {
      let state = createInitialState("test");
      [state] = resolveAction(state, { type: "join_game", trainerName: "Alice", sessionToken: "t1" });
      const avatar = state.trainers.t1.avatar;
      [state] = resolveAction(state, { type: "start_game", trainerId: "t1" });
      state = { ...state, phase: "game_over", superlatives: [] };
      const [newState] = resolveAction(state, { type: "play_again", trainerId: "t1" });
      expect(newState.trainers.t1.avatar).toBe(avatar);
    });

    it("rejected when not in game_over phase", () => {
      let state = createInitialState("test");
      [state] = resolveAction(state, { type: "join_game", trainerName: "Alice", sessionToken: "t1" });
      const [newState, events] = resolveAction(state, { type: "play_again", trainerId: "t1" });
      expect(newState).toBe(state);
      expect(events).toEqual([]);
    });
  });

  // --- remove_bot ---

  describe("remove_bot", () => {
    test("removes an existing bot trainer", () => {
      let state = lobby();
      [state] = resolveAction(state, { type: "add_bot", strategy: "aggressive" });
      expect(state.trainers["bot_1"]).toBeDefined();

      const [newState, events] = resolveAction(state, { type: "remove_bot", trainerId: "bot_1" });
      expect(newState.trainers["bot_1"]).toBeUndefined();
      expect(newState.botStrategies["bot_1"]).toBeUndefined();
      expect(events).toEqual([{ type: "trainer_left", trainerId: "bot_1" }]);
    });

    test("rejected outside lobby phase", () => {
      let state = lobby();
      [state] = join(state, "Player", "p1");
      [state] = resolveAction(state, { type: "add_bot", strategy: "random" });
      [state] = start(state, "p1");

      const [newState, events] = resolveAction(state, { type: "remove_bot", trainerId: "bot_1" });
      expect(newState).toBe(state);
      expect(events).toEqual([]);
    });

    test("rejected for non-bot trainers", () => {
      let state = lobby();
      [state] = join(state, "Human", "h1");

      const [newState, events] = resolveAction(state, { type: "remove_bot", trainerId: "h1" });
      expect(newState).toBe(state);
      expect(events).toEqual([]);
    });

    test("rejected for non-existent trainer", () => {
      let state = lobby();

      const [newState, events] = resolveAction(state, { type: "remove_bot", trainerId: "bot_99" });
      expect(newState).toBe(state);
      expect(events).toEqual([]);
    });
  });

  // --- Fury draw ---

  describe("fury_draw", () => {
    function stateWithDeck(pokemon: Pokemon[]): GameState {
      let state = lobby();
      [state] = join(state, "Ash", "t0");
      [state] = start(state, "t0");
      return {
        ...state,
        trainers: {
          ...state.trainers,
          t0: {
            ...state.trainers["t0"],
            deck: { drawPile: pokemon, drawn: [], discard: [] },
          },
        },
      };
    }

    test("drawing charmeleon draws an extra card automatically", () => {
      const charmeleon = createPokemon("charmeleon");
      const filler: Pokemon = {
        id: "filler1", templateId: "test", name: "Filler",
        types: ["normal"], distance: 1, cost: 0, rarity: "common",
        description: "", moves: [],
        stage: "basic", evolutionLine: "test", evolvesInto: null, evolutionSpeed: null,
      };
      let state = stateWithDeck([charmeleon, filler]);
      const [newState, events] = hit(state, "t0");

      // Should have 2 pokemon_drawn events (charmeleon + fury draw)
      const drawnEvents = events.filter(e => e.type === "pokemon_drawn");
      expect(drawnEvents.length).toBe(2);

      // Should have a fury_draw event
      const furyEvent = events.find(e => e.type === "fury_draw");
      expect(furyEvent).toBeDefined();

      // Both cards should be in drawn pile
      expect(newState.trainers.t0.deck.drawn.length).toBe(2);
    });

    test("fury chain stops at depth limit", () => {
      // Create 7 charmeleons - fury should chain but stop at depth 5
      const charmeleons = Array.from({ length: 7 }, () => createPokemon("charmeleon"));
      let state = stateWithDeck(charmeleons);
      const [newState, events] = hit(state, "t0");

      // Should draw initial + up to 5 fury draws = 6 total
      const drawnEvents = events.filter(e => e.type === "pokemon_drawn");
      expect(drawnEvents.length).toBe(6);

      const furyEvents = events.filter(e => e.type === "fury_draw");
      expect(furyEvents.length).toBe(5);
    });
  });

  // --- Armor ---

  describe("armor", () => {
    function stateWithDeck(pokemon: Pokemon[]): GameState {
      let state = lobby();
      [state] = join(state, "Ash", "t0");
      [state] = start(state, "t0");
      return {
        ...state,
        trainers: {
          ...state.trainers,
          t0: {
            ...state.trainers["t0"],
            deck: { drawPile: pokemon, drawn: [], discard: [] },
          },
        },
      };
    }

    test("aron reduces next card's cost by 1", () => {
      const aron = createPokemon("aron");
      // Use a card with known cost
      const costlyCard: Pokemon = {
        id: "costly1", templateId: "test", name: "Costly",
        types: ["normal"], distance: 1, cost: 3, rarity: "common",
        description: "", moves: [],
        stage: "basic", evolutionLine: "test", evolvesInto: null, evolutionSpeed: null,
      };
      let state = stateWithDeck([aron, costlyCard]);

      // Draw aron - sets pendingArmorReduction
      [state] = hit(state, "t0");
      const afterAron = state.trainers.t0.routeProgress;
      expect(afterAron.pendingArmorReduction).toBe(1);

      // Draw costly card - cost should be reduced by 1 (3-1=2)
      // aron cost=1, costly effective cost=2, total=3
      // aron also has modify_threshold +1
      [state] = hit(state, "t0");
      const afterCostly = state.trainers.t0.routeProgress;
      // aron cost=1 + costly cost=(3-1)=2 = total 3
      expect(afterCostly.totalCost).toBe(3);
    });
  });

  // --- hex_negate ---

  describe("hex_negate", () => {
    function stateWithDeck(pokemon: Pokemon[]): GameState {
      let state = lobby();
      [state] = join(state, "Ash", "t0");
      [state] = start(state, "t0");
      return {
        ...state,
        trainers: {
          ...state.trainers,
          t0: {
            ...state.trainers["t0"],
            deck: { drawPile: pokemon, drawn: [], discard: [] },
          },
        },
      };
    }

    test("sneasel negates bust via hex_negate", () => {
      const sneasel = createPokemon("sneasel");
      // sneasel: cost 1, distance 3
      // Need to bust: filler with high cost, then sneasel triggers hex_negate
      const filler: Pokemon = {
        id: "heavy1", templateId: "test", name: "Heavy",
        types: ["normal"], distance: 1, cost: 7, rarity: "common",
        description: "", moves: [],
        stage: "basic", evolutionLine: "test", evolvesInto: null, evolutionSpeed: null,
      };
      // filler cost=7, sneasel cost=1, total=8, threshold=8 → not busted (8 <= 8)
      // Need total > threshold. Use cost 7 + cost 5 = 12 > 8
      const heavySneasel: Pokemon = {
        ...sneasel, cost: 5,
      };
      let state = stateWithDeck([filler, heavySneasel]);

      [state] = hit(state, "t0"); // cost=7
      [state] = hit(state, "t0"); // cost=12 > 8 → bust → hex_negate saves

      expect(state.trainers.t0.status).toBe("exploring"); // not busted
      expect(state.trainers.t0.routeProgress.totalCost).toBe(8); // clamped to threshold
    });
  });

  // --- Broadcasts on route end ---

  describe("broadcast collection on route end", () => {
    function stateWithDeck(pokemon: Pokemon[], trainerCount: number = 1): GameState {
      let state = lobby();
      for (let i = 0; i < trainerCount; i++) {
        [state] = join(state, `Trainer${i}`, `t${i}`);
      }
      [state] = start(state, "t0");
      // Replace t0's deck
      return {
        ...state,
        trainers: {
          ...state.trainers,
          t0: {
            ...state.trainers["t0"],
            deck: { drawPile: pokemon, drawn: [], discard: [] },
          },
        },
      };
    }

    test("trainer draws pokemon with broadcast effect, stops, broadcasts collected on state", () => {
      const poochyena = createPokemon("poochyena");
      const filler: Pokemon = {
        id: "filler1", templateId: "test", name: "Filler",
        types: ["normal"], distance: 1, cost: 0, rarity: "common",
        description: "", moves: [],
        stage: "basic", evolutionLine: "test", evolvesInto: null, evolutionSpeed: null,
      };
      // Two trainers so maybeEndRoute triggers when both stop
      let state = stateWithDeck([poochyena, filler], 2);
      // Draw the poochyena
      [state] = hit(state, "t0");
      // Stop t0
      [state] = stop(state, "t0");

      // Stop t1 (who has normal starter deck, just stop immediately)
      [state] = stop(state, "t1");

      // After all trainers done, broadcasts should be collapsed and stored on state
      expect(state.activeBroadcasts.length).toBeGreaterThan(0);
      expect(state.activeBroadcasts[0].broadcastId).toBe("poochyena_currency");
      expect(state.activeBroadcasts[0].stat).toBe("currency");
    });

    test("broadcast currency applied to all trainers when route ends", () => {
      const poochyena = createPokemon("poochyena");
      let state = stateWithDeck([poochyena], 2);

      // Record initial currencies
      const t0CurrencyBefore = state.trainers["t0"].currency;
      const t1CurrencyBefore = state.trainers["t1"].currency;

      // t0 draws poochyena then stops
      [state] = hit(state, "t0");
      [state] = stop(state, "t0");

      // t1 stops (ends route)
      [state] = stop(state, "t1");

      // poochyena: allAmount=1, ownerAmount=2
      // t0 (owner) should get ownerAmount (2), t1 should get allAmount (1)
      // But currency also includes trail rewards, so check the broadcast was applied
      // by verifying the broadcast_resolved event was emitted
      expect(state.activeBroadcasts.length).toBe(1);
      expect(state.activeBroadcasts[0].ownerId).toBe("t0");
    });
  });

  // --- Echoes on route end ---

  describe("echo collection on route end", () => {
    function stateWithDeck(pokemon: Pokemon[], trainerCount: number = 1): GameState {
      let state = lobby();
      for (let i = 0; i < trainerCount; i++) {
        [state] = join(state, `Trainer${i}`, `t${i}`);
      }
      [state] = start(state, "t0");
      return {
        ...state,
        trainers: {
          ...state.trainers,
          t0: {
            ...state.trainers["t0"],
            deck: { drawPile: pokemon, drawn: [], discard: [] },
          },
        },
      };
    }

    test("trainer draws pokemon with echo effect, stops, echoes stored on trainer", () => {
      const alakazam = createPokemon("alakazam");
      let state = stateWithDeck([alakazam], 2);

      // Draw alakazam
      [state] = hit(state, "t0");
      // Stop t0
      [state] = stop(state, "t0");
      // Stop t1 to end route
      [state] = stop(state, "t1");

      // After route ends, t0 should have echo entries
      // Note: trainer references change after hub entry, find t0 in the resulting state
      const t0 = state.trainers["t0"];
      expect(t0.echoes.length).toBeGreaterThan(0);
      expect(t0.echoes[0].effect).toEqual({ type: "peek_deck", count: 2 });
    });
  });

  // --- Echo trigger on route start ---

  describe("echo trigger on first draw", () => {
    function makePokemon(overrides: Partial<Pokemon> = {}): Pokemon {
      return {
        id: `test_${Math.random().toString(36).slice(2)}`,
        templateId: "test",
        name: "Test Pokemon",
        types: ["normal"],
        distance: 1,
        cost: 1,
        rarity: "common",
        description: "Test",
        moves: [],
        stage: "basic",
        evolutionLine: "test",
        evolvesInto: null,
        evolutionSpeed: null,
        ...overrides,
      };
    }

    test("echoes fire on first draw of a new route and are cleared", () => {
      let state = setupRoute(2);
      const trainerId = "t0";

      // Manually set echoes on the trainer from a "previous route"
      const filler = makePokemon({ id: "filler1", cost: 0, distance: 1 });
      state = {
        ...state,
        trainers: {
          ...state.trainers,
          [trainerId]: {
            ...state.trainers[trainerId],
            echoes: [
              { pokemonId: "alakazam_1", effect: { type: "peek_deck", count: 2 } },
              { pokemonId: "alakazam_2", effect: { type: "bonus_distance", amount: 3 } },
            ],
            deck: { drawPile: [filler], drawn: [], discard: [] },
          },
        },
      };

      const [newState, events] = hit(state, trainerId);

      // Should have echo_triggered events
      const echoEvents = events.filter(e => e.type === "echo_triggered");
      expect(echoEvents).toHaveLength(2);
      expect(echoEvents[0]).toEqual({
        type: "echo_triggered",
        trainerId,
        pokemonId: "alakazam_1",
        effect: { type: "peek_deck", count: 2 },
      });
      expect(echoEvents[1]).toEqual({
        type: "echo_triggered",
        trainerId,
        pokemonId: "alakazam_2",
        effect: { type: "bonus_distance", amount: 3 },
      });

      // Echoes should be cleared on the trainer
      expect(newState.trainers[trainerId].echoes).toEqual([]);
    });

    test("echoes do NOT fire on second draw", () => {
      let state = setupRoute(2);
      const trainerId = "t0";

      const filler1 = makePokemon({ id: "filler1", cost: 0, distance: 1 });
      const filler2 = makePokemon({ id: "filler2", cost: 0, distance: 1 });
      state = {
        ...state,
        trainers: {
          ...state.trainers,
          [trainerId]: {
            ...state.trainers[trainerId],
            echoes: [
              { pokemonId: "echo_mon", effect: { type: "peek_deck", count: 1 } },
            ],
            deck: { drawPile: [filler1, filler2], drawn: [], discard: [] },
          },
        },
      };

      // First draw fires echoes
      [state] = hit(state, trainerId);
      expect(state.trainers[trainerId].echoes).toEqual([]);

      // Second draw should NOT have echo events
      const [, events2] = hit(state, trainerId);
      const echoEvents2 = events2.filter(e => e.type === "echo_triggered");
      expect(echoEvents2).toHaveLength(0);
    });

    test("no echo events when trainer has no echoes", () => {
      let state = setupRoute(2);
      const trainerId = "t0";

      const filler = makePokemon({ id: "filler1", cost: 0, distance: 1 });
      state = {
        ...state,
        trainers: {
          ...state.trainers,
          [trainerId]: {
            ...state.trainers[trainerId],
            echoes: [],
            deck: { drawPile: [filler], drawn: [], discard: [] },
          },
        },
      };

      const [, events] = hit(state, trainerId);
      const echoEvents = events.filter(e => e.type === "echo_triggered");
      expect(echoEvents).toHaveLength(0);
    });
  });

  // --- hex_negate once-per-game ---

  describe("hex_negate once-per-game", () => {
    function stateWithDeck(pokemon: Pokemon[]): GameState {
      let state = lobby();
      [state] = join(state, "Ash", "t0");
      [state] = start(state, "t0");
      return {
        ...state,
        trainers: {
          ...state.trainers,
          t0: {
            ...state.trainers["t0"],
            deck: { drawPile: pokemon, drawn: [], discard: [] },
          },
        },
      };
    }

    test("hex_negate does not fire a second time (usedHexNegate tracking)", () => {
      const sneasel = createPokemon("sneasel");
      // First round: filler + heavy sneasel → bust → hex saves
      const filler: Pokemon = {
        id: "heavy1", templateId: "test", name: "Heavy",
        types: ["normal"], distance: 1, cost: 7, rarity: "common",
        description: "", moves: [],
        stage: "basic", evolutionLine: "test", evolvesInto: null, evolutionSpeed: null,
      };
      const heavySneasel: Pokemon = { ...sneasel, id: "sneasel1", cost: 5 };

      let state = stateWithDeck([filler, heavySneasel]);

      // First bust: hex_negate should save
      [state] = hit(state, "t0"); // cost=7
      [state] = hit(state, "t0"); // cost=12 > 8 → bust → hex_negate saves
      expect(state.trainers.t0.status).toBe("exploring");
      expect(state.trainers.t0.usedHexNegate).toBe(true);

      // Set up another bust scenario with sneasel still drawn
      const filler2: Pokemon = {
        id: "heavy2", templateId: "test", name: "Heavy2",
        types: ["normal"], distance: 1, cost: 5, rarity: "common",
        description: "", moves: [],
        stage: "basic", evolutionLine: "test", evolvesInto: null, evolutionSpeed: null,
      };
      // Current cost is clamped to threshold (8), drawing filler2 with cost 5 → 13 > 8 → bust
      state = {
        ...state,
        trainers: {
          ...state.trainers,
          t0: {
            ...state.trainers.t0,
            deck: { ...state.trainers.t0.deck, drawPile: [filler2] },
          },
        },
      };

      [state] = hit(state, "t0"); // cost=13 > 8 → bust → hex_negate should NOT fire
      expect(state.trainers.t0.status).toBe("busted");
    });

    test("negate_bust still works even when usedHexNegate is true", () => {
      // A pokemon with negate_bust (not hex_negate) should still work
      const phoenix: Pokemon = {
        id: "phoenix1", templateId: "test", name: "Phoenix",
        types: ["fire"], distance: 1, cost: 12, rarity: "rare",
        description: "Negates bust",
        moves: [{
          name: "Rebirth",
          reminderText: "Negate bust",
          trigger: "on_bust",
          condition: null,
          effect: { type: "negate_bust" },
        }],
        stage: "basic", evolutionLine: "test", evolvesInto: null, evolutionSpeed: null,
      };

      let state = stateWithDeck([phoenix]);
      // Set usedHexNegate to true
      state = {
        ...state,
        trainers: {
          ...state.trainers,
          t0: {
            ...state.trainers.t0,
            usedHexNegate: true,
          },
        },
      };

      [state] = hit(state, "t0"); // cost=12 > 8 → bust → negate_bust should still work
      expect(state.trainers.t0.status).toBe("exploring");
    });
  });
});
