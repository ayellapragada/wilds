import { describe, it, expect } from "vitest";
import { createTVView, createPhoneView } from "../views";
import { createInitialState } from "../index";
import type { GameState, Trainer } from "../types";

function makeTrainer(id: string, overrides: Partial<Trainer> = {}): Trainer {
  return {
    id,
    sessionToken: id,
    name: `Trainer ${id}`,
    deck: { drawPile: [], drawn: [], discard: [] },
    score: 0,
    bustThreshold: 10,
    currency: 0,
    items: [],
    status: "waiting",
    routeProgress: { totalDistance: 0, totalCost: 0, pokemonDrawn: 0, activeEffects: [] },
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

  it("returns me as null-ish fields when trainerId not found", () => {
    const state = stateWithTrainers("t1");
    const view = createPhoneView(state, "unknown");
    expect(view.me).toBeUndefined();
    expect(Object.keys(view.otherTrainers)).toEqual(["t1"]);
  });
});
