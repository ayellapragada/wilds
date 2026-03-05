import { describe, test, expect } from "vitest";
import { checkCondition, resolveAbility } from "../abilities/resolver";
import type { AbilityCondition } from "../abilities/types";
import type { Creature, RouteProgress } from "../types";
import { resolveAction } from "../action-resolver";
import { createInitialState } from "../index";
import type { GameState } from "../types";

function creature(overrides: Partial<Creature> = {}): Creature {
  return {
    id: "c1", templateId: "test", name: "Test",
    type: "fire", distance: 1, cost: 1, rarity: "common",
    description: "", ability: null, ...overrides,
  };
}

function progress(overrides: Partial<RouteProgress> = {}): RouteProgress {
  return {
    totalDistance: 0, totalCost: 0, creaturesDrawn: 0,
    activeEffects: [], ...overrides,
  };
}

describe("checkCondition", () => {
  test("null condition always passes", () => {
    expect(checkCondition(null, creature(), [], progress(), 10)).toBe(true);
  });

  test("element_count passes when enough matching creatures drawn", () => {
    const cond: AbilityCondition = { type: "element_count", element: "fire", min: 2 };
    const drawn = [creature({ type: "fire" }), creature({ type: "fire" })];
    expect(checkCondition(cond, creature(), drawn, progress(), 10)).toBe(true);
  });

  test("element_count fails when not enough", () => {
    const cond: AbilityCondition = { type: "element_count", element: "fire", min: 2 };
    const drawn = [creature({ type: "fire" })];
    expect(checkCondition(cond, creature(), drawn, progress(), 10)).toBe(false);
  });

  test("min_cards_played passes when enough drawn", () => {
    const cond: AbilityCondition = { type: "min_cards_played", min: 3 };
    const prog = progress({ creaturesDrawn: 3 });
    expect(checkCondition(cond, creature(), [], prog, 10)).toBe(true);
  });

  test("min_cards_played fails when not enough", () => {
    const cond: AbilityCondition = { type: "min_cards_played", min: 3 };
    const prog = progress({ creaturesDrawn: 2 });
    expect(checkCondition(cond, creature(), [], prog, 10)).toBe(false);
  });

  test("position first passes on first draw", () => {
    const cond: AbilityCondition = { type: "position", position: "first" };
    const prog = progress({ creaturesDrawn: 1 });
    expect(checkCondition(cond, creature(), [], prog, 10)).toBe(true);
  });

  test("position first fails on later draw", () => {
    const cond: AbilityCondition = { type: "position", position: "first" };
    const prog = progress({ creaturesDrawn: 3 });
    expect(checkCondition(cond, creature(), [], prog, 10)).toBe(false);
  });

  test("would_bust passes when cost exceeds threshold", () => {
    const cond: AbilityCondition = { type: "would_bust" };
    const c = creature({ cost: 5 });
    const prog = progress({ totalCost: 8 });
    expect(checkCondition(cond, c, [], prog, 10)).toBe(true);
  });

  test("would_bust fails when under threshold", () => {
    const cond: AbilityCondition = { type: "would_bust" };
    const c = creature({ cost: 1 });
    const prog = progress({ totalCost: 5 });
    expect(checkCondition(cond, c, [], prog, 10)).toBe(false);
  });

  test("neighbor_element passes when previous creature matches", () => {
    const cond: AbilityCondition = { type: "neighbor_element", element: "water" };
    const drawn = [creature({ type: "water" })];
    expect(checkCondition(cond, creature(), drawn, progress(), 10)).toBe(true);
  });

  test("neighbor_element fails when previous creature differs", () => {
    const cond: AbilityCondition = { type: "neighbor_element", element: "water" };
    const drawn = [creature({ type: "fire" })];
    expect(checkCondition(cond, creature(), drawn, progress(), 10)).toBe(false);
  });

  test("neighbor_element fails when no previous creature", () => {
    const cond: AbilityCondition = { type: "neighbor_element", element: "water" };
    expect(checkCondition(cond, creature(), [], progress(), 10)).toBe(false);
  });
});

describe("resolveAbility", () => {
  test("returns null for creature with no ability", () => {
    const result = resolveAbility(creature(), "on_draw", [], progress(), 10);
    expect(result).toBeNull();
  });

  test("returns null when trigger doesn't match", () => {
    const c = creature({
      ability: {
        trigger: "end_of_round",
        condition: null,
        effect: { type: "bonus_distance", amount: 3 },
      },
    });
    const result = resolveAbility(c, "on_draw", [], progress(), 10);
    expect(result).toBeNull();
  });

  test("returns null when condition fails", () => {
    const c = creature({
      ability: {
        trigger: "on_draw",
        condition: { type: "element_count", element: "fire", min: 5 },
        effect: { type: "bonus_distance", amount: 3 },
      },
    });
    const result = resolveAbility(c, "on_draw", [], progress(), 10);
    expect(result).toBeNull();
  });

  test("returns effect when trigger and condition match", () => {
    const c = creature({
      ability: {
        trigger: "on_draw",
        condition: null,
        effect: { type: "bonus_distance", amount: 3 },
      },
    });
    const result = resolveAbility(c, "on_draw", [], progress(), 10);
    expect(result).toEqual({ type: "bonus_distance", amount: 3 });
  });

  test("bonus_distance_per calculates based on element count", () => {
    const c = creature({
      ability: {
        trigger: "on_draw",
        condition: null,
        effect: { type: "bonus_distance_per", amount: 1, per: "element_count", element: "fire" },
      },
    });
    const drawn = [
      creature({ type: "fire" }),
      creature({ type: "fire" }),
      creature({ type: "water" }),
    ];
    const result = resolveAbility(c, "on_draw", drawn, progress(), 10);
    expect(result).toEqual({ type: "bonus_distance", amount: 2 });
  });

  test("bonus_distance_per returns 0 distance when no matches", () => {
    const c = creature({
      ability: {
        trigger: "on_draw",
        condition: null,
        effect: { type: "bonus_distance_per", amount: 1, per: "element_count", element: "fire" },
      },
    });
    const result = resolveAbility(c, "on_draw", [], progress(), 10);
    expect(result).toEqual({ type: "bonus_distance", amount: 0 });
  });
});

// === Integration test helpers ===

/** Create a game in route phase with a custom deck for trainer t0 */
function stateWithDeck(creatures: Creature[]): GameState {
  let state = createInitialState("TEST");
  state = resolveAction(state, { type: "join_game", trainerName: "Ash", sessionToken: "t0" })[0];
  state = resolveAction(state, { type: "start_game", trainerId: "t0" })[0];
  return {
    ...state,
    trainers: {
      ...state.trainers,
      t0: {
        ...state.trainers["t0"],
        deck: { drawPile: creatures, drawn: [], discard: [] },
      },
    },
  };
}

function makeCreature(id: string, overrides: Partial<Creature> = {}): Creature {
  return {
    id, templateId: "test", name: "Test", type: "fire",
    distance: 2, cost: 1, rarity: "common", description: "",
    ability: null, ...overrides,
  };
}

describe("abilities integration (through handleHit)", () => {
  test("bonus_distance adds to total distance on draw", () => {
    const c = makeCreature("c1", {
      distance: 2, cost: 1,
      ability: {
        trigger: "on_draw",
        condition: null,
        effect: { type: "bonus_distance", amount: 3 },
      },
    });
    let state = stateWithDeck([c]);
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" });
    expect(state.trainers["t0"].routeProgress.totalDistance).toBe(5); // 2 base + 3 bonus
  });

  test("modify_threshold changes bust threshold for route", () => {
    const c = makeCreature("c1", {
      distance: 1, cost: 0,
      ability: {
        trigger: "on_draw",
        condition: null,
        effect: { type: "modify_threshold", amount: 2, duration: "route" },
      },
    });
    let state = stateWithDeck([c]);
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" });
    expect(state.trainers["t0"].bustThreshold).toBe(12); // 10 base + 2
  });

  test("reduce_cost self reduces this creature's cost contribution", () => {
    const c = makeCreature("c1", {
      distance: 3, cost: 5,
      ability: {
        trigger: "on_draw",
        condition: null,
        effect: { type: "reduce_cost", amount: 2, target: "self" },
      },
    });
    let state = stateWithDeck([c]);
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" });
    expect(state.trainers["t0"].routeProgress.totalCost).toBe(3); // 5 - 2
  });

  test("reduce_cost all reduces total accumulated cost", () => {
    const vanilla = makeCreature("c1", { distance: 2, cost: 4 });
    const reducer = makeCreature("c2", {
      distance: 1, cost: 2,
      ability: {
        trigger: "on_draw",
        condition: null,
        effect: { type: "reduce_cost", amount: 3, target: "all" },
      },
    });
    let state = stateWithDeck([vanilla, reducer]);
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" }); // cost=4
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" }); // cost=4+2-3=3
    expect(state.trainers["t0"].routeProgress.totalCost).toBe(3);
  });

  test("would_bust condition with reduce_cost prevents bust", () => {
    const shadow_fox = makeCreature("fox", {
      type: "shadow", distance: 4, cost: 5,
      ability: {
        trigger: "on_draw",
        condition: { type: "would_bust" },
        effect: { type: "reduce_cost", amount: "all", target: "self" },
      },
    });
    const filler = makeCreature("f1", { distance: 1, cost: 7 });
    let state = stateWithDeck([filler, shadow_fox]);
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" }); // cost=7
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" }); // fox: would bust, so cost becomes 7+0=7
    expect(state.trainers["t0"].status).toBe("exploring");
    expect(state.trainers["t0"].routeProgress.totalCost).toBe(7);
  });

  test("ability_triggered event is emitted", () => {
    const c = makeCreature("c1", {
      ability: {
        trigger: "on_draw",
        condition: null,
        effect: { type: "bonus_distance", amount: 3 },
      },
    });
    let state = stateWithDeck([c]);
    const [, events] = resolveAction(state, { type: "hit", trainerId: "t0" });
    const abilityEvent = events.find(e => e.type === "ability_triggered");
    expect(abilityEvent).toBeDefined();
  });

  test("vanilla creature emits no ability event", () => {
    const c = makeCreature("c1", { ability: null });
    let state = stateWithDeck([c]);
    const [, events] = resolveAction(state, { type: "hit", trainerId: "t0" });
    const abilityEvent = events.find(e => e.type === "ability_triggered");
    expect(abilityEvent).toBeUndefined();
  });

  test("negate_bust on_bust trigger prevents bust", () => {
    const phoenix = makeCreature("phoenix", {
      type: "fire", distance: 8, cost: 7,
      ability: {
        trigger: "on_bust",
        condition: null,
        effect: { type: "negate_bust" },
      },
    });
    const filler = makeCreature("f1", { distance: 1, cost: 6 });
    // filler cost=6, phoenix cost=7 → total 13 > threshold 10 → would bust
    let state = stateWithDeck([filler, phoenix]);
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" }); // cost=6
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" }); // cost=13, phoenix negates

    expect(state.trainers["t0"].status).toBe("exploring"); // not busted
    expect(state.trainers["t0"].routeProgress.totalCost).toBe(13); // cost still high
  });

  test("negate_bust emits ability_triggered event", () => {
    const phoenix = makeCreature("phoenix", {
      type: "fire", distance: 8, cost: 7,
      ability: {
        trigger: "on_bust",
        condition: null,
        effect: { type: "negate_bust" },
      },
    });
    const filler = makeCreature("f1", { distance: 1, cost: 6 });
    let state = stateWithDeck([filler, phoenix]);
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" });
    const [, events] = resolveAction(state, { type: "hit", trainerId: "t0" });

    const negateEvent = events.find(
      e => e.type === "ability_triggered" && e.effect.type === "negate_bust"
    );
    expect(negateEvent).toBeDefined();
    // Should NOT have a trainer_busted event
    expect(events.find(e => e.type === "trainer_busted")).toBeUndefined();
  });

  test("negate_bust works with dragon_king + phoenix (exact sandbox scenario)", () => {
    const dragon_king = makeCreature("dk", {
      type: "fire", distance: 12, cost: 10,
      ability: {
        trigger: "on_draw",
        condition: null,
        effect: { type: "bonus_distance_per", amount: 2, per: "element_count", element: "fire" },
      },
    });
    const phoenix = makeCreature("phoenix", {
      type: "fire", distance: 8, cost: 7,
      ability: {
        trigger: "on_bust",
        condition: null,
        effect: { type: "negate_bust" },
      },
    });
    let state = stateWithDeck([dragon_king, phoenix]);
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" }); // DK: cost=10, threshold=10, not busted (10 <= 10)
    expect(state.trainers["t0"].status).toBe("exploring");
    expect(state.trainers["t0"].routeProgress.totalCost).toBe(10);

    [state] = resolveAction(state, { type: "hit", trainerId: "t0" }); // Phoenix: cost=17 > 10, busted → negate_bust
    expect(state.trainers["t0"].status).toBe("exploring"); // phoenix should save
  });

  test("without negate_bust, trainer still busts normally", () => {
    const filler1 = makeCreature("f1", { distance: 1, cost: 6 });
    const filler2 = makeCreature("f2", { distance: 1, cost: 6 });
    let state = stateWithDeck([filler1, filler2]);
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" });
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" });

    expect(state.trainers["t0"].status).toBe("busted");
  });
});
