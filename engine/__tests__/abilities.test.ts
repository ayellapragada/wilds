import { describe, test, expect } from "vitest";
import { checkCondition, resolveMoves } from "../abilities/resolver";
import type { AbilityCondition } from "../abilities/types";
import type { Pokemon, RouteProgress } from "../types";
import { resolveAction } from "../action-resolver";
import { createInitialState } from "../index";
import type { GameState } from "../types";

function pokemon(overrides: Partial<Pokemon> = {}): Pokemon {
  return {
    id: "c1", templateId: "test", name: "Test",
    types: ["fire"], distance: 1, cost: 1, rarity: "common",
    description: "", moves: [], ...overrides,
  };
}

function progress(overrides: Partial<RouteProgress> = {}): RouteProgress {
  return {
    totalDistance: 0, totalCost: 0, pokemonDrawn: 0,
    activeEffects: [], ...overrides,
  };
}

describe("checkCondition", () => {
  test("null condition always passes", () => {
    expect(checkCondition(null, pokemon(), [], progress(), 10)).toBe(true);
  });

  test("element_count passes when enough matching pokemon drawn", () => {
    const cond: AbilityCondition = { type: "element_count", element: "fire", min: 2 };
    const drawn = [pokemon({ types: ["fire"] }), pokemon({ types: ["fire"] })];
    expect(checkCondition(cond, pokemon(), drawn, progress(), 10)).toBe(true);
  });

  test("element_count fails when not enough", () => {
    const cond: AbilityCondition = { type: "element_count", element: "fire", min: 2 };
    const drawn = [pokemon({ types: ["fire"] })];
    expect(checkCondition(cond, pokemon(), drawn, progress(), 10)).toBe(false);
  });

  test("min_cards_played passes when enough drawn", () => {
    const cond: AbilityCondition = { type: "min_cards_played", min: 3 };
    const prog = progress({ pokemonDrawn: 3 });
    expect(checkCondition(cond, pokemon(), [], prog, 10)).toBe(true);
  });

  test("min_cards_played fails when not enough", () => {
    const cond: AbilityCondition = { type: "min_cards_played", min: 3 };
    const prog = progress({ pokemonDrawn: 2 });
    expect(checkCondition(cond, pokemon(), [], prog, 10)).toBe(false);
  });

  test("position first passes on first draw", () => {
    const cond: AbilityCondition = { type: "position", position: "first" };
    const prog = progress({ pokemonDrawn: 1 });
    expect(checkCondition(cond, pokemon(), [], prog, 10)).toBe(true);
  });

  test("position first fails on later draw", () => {
    const cond: AbilityCondition = { type: "position", position: "first" };
    const prog = progress({ pokemonDrawn: 3 });
    expect(checkCondition(cond, pokemon(), [], prog, 10)).toBe(false);
  });

  test("would_bust passes when cost exceeds threshold", () => {
    const cond: AbilityCondition = { type: "would_bust" };
    const c = pokemon({ cost: 5 });
    const prog = progress({ totalCost: 8 });
    expect(checkCondition(cond, c, [], prog, 10)).toBe(true);
  });

  test("would_bust fails when under threshold", () => {
    const cond: AbilityCondition = { type: "would_bust" };
    const c = pokemon({ cost: 1 });
    const prog = progress({ totalCost: 5 });
    expect(checkCondition(cond, c, [], prog, 10)).toBe(false);
  });

  test("neighbor_element passes when previous pokemon matches", () => {
    const cond: AbilityCondition = { type: "neighbor_element", element: "water" };
    const drawn = [pokemon({ types: ["water"] })];
    expect(checkCondition(cond, pokemon(), drawn, progress(), 10)).toBe(true);
  });

  test("neighbor_element fails when previous pokemon differs", () => {
    const cond: AbilityCondition = { type: "neighbor_element", element: "water" };
    const drawn = [pokemon({ types: ["fire"] })];
    expect(checkCondition(cond, pokemon(), drawn, progress(), 10)).toBe(false);
  });

  test("neighbor_element fails when no previous pokemon", () => {
    const cond: AbilityCondition = { type: "neighbor_element", element: "water" };
    expect(checkCondition(cond, pokemon(), [], progress(), 10)).toBe(false);
  });
});

describe("resolveMoves", () => {
  test("returns empty array for pokemon with no moves", () => {
    const result = resolveMoves(pokemon(), "on_draw", [], progress(), 10);
    expect(result).toEqual([]);
  });

  test("returns empty array when trigger doesn't match", () => {
    const c = pokemon({
      moves: [{
        name: "Test", reminderText: "test",
        trigger: "end_of_round",
        condition: null,
        effect: { type: "bonus_distance", amount: 3 },
      }],
    });
    const result = resolveMoves(c, "on_draw", [], progress(), 10);
    expect(result).toEqual([]);
  });

  test("returns empty array when condition fails", () => {
    const c = pokemon({
      moves: [{
        name: "Test", reminderText: "test",
        trigger: "on_draw",
        condition: { type: "element_count", element: "fire", min: 5 },
        effect: { type: "bonus_distance", amount: 3 },
      }],
    });
    const result = resolveMoves(c, "on_draw", [], progress(), 10);
    expect(result).toEqual([]);
  });

  test("returns effect when trigger and condition match", () => {
    const c = pokemon({
      moves: [{
        name: "Test", reminderText: "test",
        trigger: "on_draw",
        condition: null,
        effect: { type: "bonus_distance", amount: 3 },
      }],
    });
    const result = resolveMoves(c, "on_draw", [], progress(), 10);
    expect(result).toEqual([{ type: "bonus_distance", amount: 3 }]);
  });

  test("bonus_distance_per calculates based on element count", () => {
    const c = pokemon({
      moves: [{
        name: "Test", reminderText: "test",
        trigger: "on_draw",
        condition: null,
        effect: { type: "bonus_distance_per", amount: 1, per: "element_count", element: "fire" },
      }],
    });
    const drawn = [
      pokemon({ types: ["fire"] }),
      pokemon({ types: ["fire"] }),
      pokemon({ types: ["water"] }),
    ];
    const result = resolveMoves(c, "on_draw", drawn, progress(), 10);
    expect(result).toEqual([{ type: "bonus_distance", amount: 2 }]);
  });

  test("bonus_distance_per returns 0 distance when no matches", () => {
    const c = pokemon({
      moves: [{
        name: "Test", reminderText: "test",
        trigger: "on_draw",
        condition: null,
        effect: { type: "bonus_distance_per", amount: 1, per: "element_count", element: "fire" },
      }],
    });
    const result = resolveMoves(c, "on_draw", [], progress(), 10);
    expect(result).toEqual([{ type: "bonus_distance", amount: 0 }]);
  });
});

// === Integration test helpers ===

/** Create a game in route phase with a custom deck for trainer t0 */
function stateWithDeck(pokemon: Pokemon[]): GameState {
  let state = createInitialState("TEST");
  state = resolveAction(state, { type: "join_game", trainerName: "Ash", sessionToken: "t0" })[0];
  state = resolveAction(state, { type: "start_game", trainerId: "t0" })[0];
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

function makePokemon(id: string, overrides: Partial<Pokemon> = {}): Pokemon {
  return {
    id, templateId: "test", name: "Test", types: ["fire"],
    distance: 2, cost: 1, rarity: "common", description: "",
    moves: [], ...overrides,
  };
}

describe("abilities integration (through handleHit)", () => {
  test("bonus_distance adds to total distance on draw", () => {
    const c = makePokemon("c1", {
      distance: 2, cost: 1,
      moves: [{
        name: "Test", reminderText: "test",
        trigger: "on_draw",
        condition: null,
        effect: { type: "bonus_distance", amount: 3 },
      }],
    });
    let state = stateWithDeck([c]);
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" });
    expect(state.trainers["t0"].routeProgress.totalDistance).toBe(5); // 2 base + 3 bonus
  });

  test("modify_threshold changes bust threshold for route", () => {
    const c = makePokemon("c1", {
      distance: 1, cost: 0,
      moves: [{
        name: "Test", reminderText: "test",
        trigger: "on_draw",
        condition: null,
        effect: { type: "modify_threshold", amount: 2, duration: "route" },
      }],
    });
    let state = stateWithDeck([c]);
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" });
    expect(state.trainers["t0"].bustThreshold).toBe(10); // 8 base + 2
  });

  test("reduce_cost self reduces this pokemon's cost contribution", () => {
    const c = makePokemon("c1", {
      distance: 3, cost: 5,
      moves: [{
        name: "Test", reminderText: "test",
        trigger: "on_draw",
        condition: null,
        effect: { type: "reduce_cost", amount: 2, target: "self" },
      }],
    });
    let state = stateWithDeck([c]);
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" });
    expect(state.trainers["t0"].routeProgress.totalCost).toBe(3); // 5 - 2
  });

  test("reduce_cost all reduces total accumulated cost", () => {
    const vanilla = makePokemon("c1", { distance: 2, cost: 4 });
    const reducer = makePokemon("c2", {
      distance: 1, cost: 2,
      moves: [{
        name: "Test", reminderText: "test",
        trigger: "on_draw",
        condition: null,
        effect: { type: "reduce_cost", amount: 3, target: "all" },
      }],
    });
    let state = stateWithDeck([vanilla, reducer]);
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" }); // cost=4
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" }); // cost=4+2-3=3
    expect(state.trainers["t0"].routeProgress.totalCost).toBe(3);
  });

  test("would_bust condition with reduce_cost prevents bust", () => {
    const dark_fox = makePokemon("fox", {
      types: ["dark"], distance: 4, cost: 5,
      moves: [{
        name: "Test", reminderText: "test",
        trigger: "on_draw",
        condition: { type: "would_bust" },
        effect: { type: "reduce_cost", amount: "all", target: "self" },
      }],
    });
    const filler = makePokemon("f1", { distance: 1, cost: 7 });
    let state = stateWithDeck([filler, dark_fox]);
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" }); // cost=7
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" }); // fox: would bust, so cost becomes 7+0=7
    expect(state.trainers["t0"].status).toBe("exploring");
    expect(state.trainers["t0"].routeProgress.totalCost).toBe(7);
  });

  test("ability_triggered event is emitted", () => {
    const c = makePokemon("c1", {
      moves: [{
        name: "Test", reminderText: "test",
        trigger: "on_draw",
        condition: null,
        effect: { type: "bonus_distance", amount: 3 },
      }],
    });
    let state = stateWithDeck([c]);
    const [, events] = resolveAction(state, { type: "hit", trainerId: "t0" });
    const abilityEvent = events.find(e => e.type === "ability_triggered");
    expect(abilityEvent).toBeDefined();
  });

  test("vanilla pokemon emits no ability event", () => {
    const c = makePokemon("c1", { moves: [] });
    let state = stateWithDeck([c]);
    const [, events] = resolveAction(state, { type: "hit", trainerId: "t0" });
    const abilityEvent = events.find(e => e.type === "ability_triggered");
    expect(abilityEvent).toBeUndefined();
  });

  test("negate_bust on_bust trigger prevents bust", () => {
    const phoenix = makePokemon("phoenix", {
      types: ["fire"], distance: 8, cost: 7,
      moves: [{
        name: "Test", reminderText: "test",
        trigger: "on_bust",
        condition: null,
        effect: { type: "negate_bust" },
      }],
    });
    const filler = makePokemon("f1", { distance: 1, cost: 6 });
    // filler cost=6, phoenix cost=7 → total 13 > threshold 10 → would bust
    let state = stateWithDeck([filler, phoenix]);
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" }); // cost=6
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" }); // cost=13, phoenix negates

    expect(state.trainers["t0"].status).toBe("exploring"); // not busted
    expect(state.trainers["t0"].routeProgress.totalCost).toBe(8); // clamped to threshold
  });

  test("negate_bust emits ability_triggered event", () => {
    const phoenix = makePokemon("phoenix", {
      types: ["fire"], distance: 8, cost: 7,
      moves: [{
        name: "Test", reminderText: "test",
        trigger: "on_bust",
        condition: null,
        effect: { type: "negate_bust" },
      }],
    });
    const filler = makePokemon("f1", { distance: 1, cost: 6 });
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
    const dragon_king = makePokemon("dk", {
      types: ["fire"], distance: 12, cost: 7,
      moves: [{
        name: "Test", reminderText: "test",
        trigger: "on_draw",
        condition: null,
        effect: { type: "bonus_distance_per", amount: 2, per: "element_count", element: "fire" },
      }],
    });
    const phoenix = makePokemon("phoenix", {
      types: ["fire"], distance: 8, cost: 5,
      moves: [{
        name: "Test", reminderText: "test",
        trigger: "on_bust",
        condition: null,
        effect: { type: "negate_bust" },
      }],
    });
    let state = stateWithDeck([dragon_king, phoenix]);
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" }); // DK: cost=7, threshold=8, not busted (7 <= 8)
    expect(state.trainers["t0"].status).toBe("exploring");
    expect(state.trainers["t0"].routeProgress.totalCost).toBe(7);

    [state] = resolveAction(state, { type: "hit", trainerId: "t0" }); // Phoenix: cost=12 > 8, busted → negate_bust
    expect(state.trainers["t0"].status).toBe("exploring"); // phoenix should save
  });

  test("without negate_bust, trainer still busts normally", () => {
    const filler1 = makePokemon("f1", { distance: 1, cost: 6 });
    const filler2 = makePokemon("f2", { distance: 1, cost: 6 });
    let state = stateWithDeck([filler1, filler2]);
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" });
    [state] = resolveAction(state, { type: "hit", trainerId: "t0" });

    expect(state.trainers["t0"].status).toBe("busted");
  });
});

describe("end_of_round trigger", () => {
  test("end_of_round moves resolve when trigger matches", () => {
    const meowth = pokemon({
      name: "Meowth", types: ["normal"],
      moves: [{
        name: "Pay Day", reminderText: "+1 currency at end of round",
        trigger: "end_of_round", condition: null,
        effect: { type: "bonus_currency", amount: 1 },
      }],
    });
    const effects = resolveMoves(meowth, "end_of_round", [meowth], progress({ pokemonDrawn: 1 }), 7);
    expect(effects).toEqual([{ type: "bonus_currency", amount: 1 }]);
  });

  test("end_of_round with min_cards_played condition", () => {
    const aipom = pokemon({
      name: "Aipom", types: ["normal"],
      moves: [{
        name: "Pickup", reminderText: "+3 currency if 4+ cards drawn",
        trigger: "end_of_round", condition: { type: "min_cards_played", min: 4 },
        effect: { type: "bonus_currency", amount: 3 },
      }],
    });
    expect(resolveMoves(aipom, "end_of_round", [aipom], progress({ pokemonDrawn: 3 }), 7)).toEqual([]);
    expect(resolveMoves(aipom, "end_of_round", [aipom], progress({ pokemonDrawn: 4 }), 7)).toEqual([{ type: "bonus_currency", amount: 3 }]);
  });
});
