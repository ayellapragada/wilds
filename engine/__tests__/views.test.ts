import { describe, it, expect } from "vitest";
import { createTVView, createPhoneView } from "../views";
import { createInitialState } from "../index";
import type { GameState, Trainer } from "../types";

function makeTrainer(id: string, overrides: Partial<Trainer> = {}): Trainer {
  return {
    id,
    sessionToken: id,
    name: `Trainer ${id}`,
    avatar: 0,
    deck: { drawPile: [], drawn: [], discard: [] },
    score: 0,
    bustThreshold: 10,
    currency: 0,
    items: [],
    status: "waiting",
    routeProgress: { totalDistance: 0, totalCost: 0, pokemonDrawn: 0, activeEffects: [], pendingArmorReduction: 0, dudArmorReduction: 0 },
    finalRouteDistance: null,
    finalRouteCost: null,
    bot: false,
    stats: { cardsDrawn: 0, bustCount: 0, maxRouteDistance: 0, totalCurrencyEarned: 0, maxCardDistance: 0, finalDeckSize: 0 },
    pendingThresholdBonus: 0,
    ...overrides,
  };
}

function stateWithTrainers(...ids: string[]): GameState {
  const base = createInitialState("TEST");
  const trainers: Record<string, Trainer> = {};
  for (const id of ids) {
    trainers[id] = makeTrainer(id);
  }
  return { ...base, trainers };
}

describe("createTVView", () => {
  it("returns type tv with room code and phase", () => {
    const state = createInitialState("ROOM1");
    const view = createTVView(state);
    expect(view.type).toBe("tv");
    expect(view.roomCode).toBe("ROOM1");
    expect(view.phase).toBe("lobby");
  });

  it("maps trainers to public info without deck details", () => {
    const state = stateWithTrainers("t1", "t2");
    const view = createTVView(state);
    expect(view.trainers["t1"].name).toBe("Trainer t1");
    expect(view.trainers["t1"].deckSize).toBe(0);
    expect(view.trainers["t1"]).not.toHaveProperty("deck");
    expect(view.trainers["t1"]).not.toHaveProperty("sessionToken");
  });

  it("includes all game state fields", () => {
    const state = createInitialState("ROOM1");
    const view = createTVView(state);
    expect(view.map).toBeNull();
    expect(view.currentRoute).toBeNull();
    expect(view.hub).toBeNull();
    expect(view.votes).toBeNull();
    expect(view.routeNumber).toBe(0);
    expect(view.settings).toEqual(state.settings);
  });
});

describe("createPhoneView", () => {
  it("returns type phone with the trainer's full data as 'me'", () => {
    const state = stateWithTrainers("t1", "t2");
    const view = createPhoneView(state, "t1");
    expect(view.type).toBe("phone");
    expect(view.me.id).toBe("t1");
    expect(view.me.deck).toBeDefined();
    expect(view.me.sessionToken).toBe("t1");
  });

  it("shows other trainers as public info only", () => {
    const state = stateWithTrainers("t1", "t2", "t3");
    const view = createPhoneView(state, "t1");
    expect(Object.keys(view.otherTrainers)).toEqual(["t2", "t3"]);
    expect(view.otherTrainers["t2"]).not.toHaveProperty("deck");
    expect(view.otherTrainers["t2"]).not.toHaveProperty("sessionToken");
    expect(view.otherTrainers["t2"].name).toBe("Trainer t2");
  });

  it("includes phase, route, hub, votes, map", () => {
    const state = stateWithTrainers("t1");
    const view = createPhoneView(state, "t1");
    expect(view.phase).toBe("lobby");
    expect(view.currentRoute).toBeNull();
    expect(view.hub).toBeNull();
    expect(view.votes).toBeNull();
    expect(view.map).toBeNull();
  });

  it("throws when trainerId not found", () => {
    const state = stateWithTrainers("t1");
    expect(() => createPhoneView(state, "unknown")).toThrow("Trainer unknown not found in game state");
  });
});

describe("blind voting", () => {
  it("redacts vote choices when not all trainers have voted", () => {
    const base = createInitialState("TEST");
    const state: GameState = {
      ...base,
      phase: "world",
      trainers: { t1: makeTrainer("t1"), t2: makeTrainer("t2") },
      votes: { t1: "node_1" },
    };
    const view = createTVView(state);
    expect(view.votes).toEqual({ t1: "__redacted__" });
  });

  it("reveals all votes when all trainers have voted", () => {
    const base = createInitialState("TEST");
    const state: GameState = {
      ...base,
      phase: "world",
      trainers: { t1: makeTrainer("t1"), t2: makeTrainer("t2") },
      votes: { t1: "node_1", t2: "node_2" },
    };
    const view = createTVView(state);
    expect(view.votes).toEqual({ t1: "node_1", t2: "node_2" });
  });
});

describe("stats in views", () => {
  it("includes stats in TrainerPublicInfo during game_over phase", () => {
    const base = createInitialState("TEST");
    const state: GameState = {
      ...base,
      phase: "game_over",
      trainers: {
        t1: makeTrainer("t1", { stats: { cardsDrawn: 5, bustCount: 1, maxRouteDistance: 10, totalCurrencyEarned: 20, maxCardDistance: 7, finalDeckSize: 8 } }),
      },
      superlatives: [],
    };
    const view = createTVView(state);
    expect(view.trainers.t1.stats).toBeDefined();
    expect(view.trainers.t1.stats!.cardsDrawn).toBe(5);
  });

  it("excludes stats from TrainerPublicInfo during route phase", () => {
    const base = createInitialState("TEST");
    const state: GameState = {
      ...base,
      phase: "route",
      trainers: {
        t1: makeTrainer("t1"),
      },
      superlatives: [],
    };
    const view = createTVView(state);
    expect(view.trainers.t1.stats).toBeUndefined();
  });

  it("includes superlatives in TV view", () => {
    const base = createInitialState("TEST");
    const state: GameState = {
      ...base,
      phase: "game_over",
      trainers: { t1: makeTrainer("t1") },
      superlatives: [{ trainerId: "t1", award: "Daredevil" }],
    };
    const view = createTVView(state);
    expect(view.superlatives).toEqual([{ trainerId: "t1", award: "Daredevil" }]);
  });

  it("includes superlatives in phone view", () => {
    const base = createInitialState("TEST");
    const state: GameState = {
      ...base,
      phase: "game_over",
      trainers: { t1: makeTrainer("t1") },
      superlatives: [{ trainerId: "t1", award: "Daredevil" }],
    };
    const view = createPhoneView(state, "t1");
    expect(view.superlatives).toEqual([{ trainerId: "t1", award: "Daredevil" }]);
  });
});

describe("riskLevel", () => {
  it("returns 'safe' when cost is below 50% of threshold", () => {
    const base = createInitialState("TEST");
    const state: GameState = {
      ...base,
      phase: "route",
      trainers: {
        t1: makeTrainer("t1", { routeProgress: { totalCost: 2, totalDistance: 0, pokemonDrawn: 1, activeEffects: [], pendingArmorReduction: 0, dudArmorReduction: 0 }, bustThreshold: 7, status: "exploring" }),
      },
    };
    const view = createTVView(state);
    expect(view.trainers.t1.riskLevel).toBe("safe");
  });

  it("returns 'risky' when cost is 50-75% of threshold", () => {
    const base = createInitialState("TEST");
    const state: GameState = {
      ...base,
      phase: "route",
      trainers: {
        t1: makeTrainer("t1", { routeProgress: { totalCost: 4, totalDistance: 0, pokemonDrawn: 1, activeEffects: [], pendingArmorReduction: 0, dudArmorReduction: 0 }, bustThreshold: 7, status: "exploring" }),
      },
    };
    const view = createTVView(state);
    expect(view.trainers.t1.riskLevel).toBe("risky");
  });

  it("returns 'danger' when cost is above 75% of threshold", () => {
    const base = createInitialState("TEST");
    const state: GameState = {
      ...base,
      phase: "route",
      trainers: {
        t1: makeTrainer("t1", { routeProgress: { totalCost: 6, totalDistance: 0, pokemonDrawn: 1, activeEffects: [], pendingArmorReduction: 0, dudArmorReduction: 0 }, bustThreshold: 7, status: "exploring" }),
      },
    };
    const view = createTVView(state);
    expect(view.trainers.t1.riskLevel).toBe("danger");
  });

  it("returns 'safe' when not in route phase", () => {
    const state = stateWithTrainers("t1");
    const view = createTVView(state);
    expect(view.trainers.t1.riskLevel).toBe("safe");
  });
});
