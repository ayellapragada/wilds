import { describe, test, expect } from "vitest";
import type { GameState, Trainer, RouteNode, WorldMap } from "../types";
import { createInitialState } from "../index";
import { resolveAction } from "../action-resolver";
import { enterHub, handleSelectPokemon, handleConfirmSelections, pokemonPrice } from "../phases/hub";
import { createPokemon } from "../pokemon/catalog";

// === Helpers ===

function makeTestState(): GameState {
  let state = createInitialState("TEST");
  [state] = resolveAction(state, { type: "join_game", trainerName: "T0", sessionToken: "t0" });
  [state] = resolveAction(state, { type: "join_game", trainerName: "T1", sessionToken: "t1" });

  const trainers: Record<string, Trainer> = {};
  for (const [id, t] of Object.entries(state.trainers)) {
    trainers[id] = { ...t, status: "waiting", currency: 10 };
  }

  const node: RouteNode = {
    id: "node1", type: "route", bonus: null, name: "Test Route", tier: 1,
    connections: ["node2"], bustThreshold: 7, modifiers: [], visited: true,
    pokemonPool: ["charmeleon", "graveler", "wartortle", "machoke", "pikachu", "snorlax"],
    currencyDistribution: { total: 3, curve: "flat" as const },
  };

  const map: WorldMap = {
    nodes: { node1: node, node2: { ...node, id: "node2", visited: false } },
    currentNodeId: "node1",
    totalTiers: 8,
  };

  return { ...state, phase: "route" as const, trainers, map };
}

function hubState(): GameState {
  const state = makeTestState();
  const [entered] = enterHub(state, [], () => 0.5);
  return entered;
}

// === enterHub tests ===

describe("enterHub", () => {
  test("creates hub state with free pick offers for non-busted trainers", () => {
    const state = makeTestState();
    const [newState] = enterHub(state, [], () => 0.5);

    expect(newState.phase).toBe("hub");
    expect(newState.hub).not.toBeNull();
    expect(newState.hub!.freePickOffers["t0"]).toHaveLength(2);
    expect(newState.hub!.freePickOffers["t1"]).toHaveLength(2);
  });

  test("busted trainers get 1 free pick offer", () => {
    const state = makeTestState();
    const [newState] = enterHub(state, ["t0"], () => 0.5);

    expect(newState.hub!.freePickOffers["t0"]).toHaveLength(1);
    expect(newState.hub!.freePickOffers["t1"]).toHaveLength(2);
  });

  test("generates shared shop with tier-scaled pokemon", () => {
    const state = makeTestState();
    const [newState] = enterHub(state, [], () => 0.5);

    expect(newState.hub!.shopPokemon.length).toBeGreaterThanOrEqual(3);
    expect(newState.hub!.shopPokemon.length).toBeLessThanOrEqual(4);
    for (const p of newState.hub!.shopPokemon) {
      expect(newState.hub!.shopPrices[p.id]).toBeDefined();
      expect(newState.hub!.shopPrices[p.id]).toBeGreaterThan(0);
    }
  });

  test("free picks have $0 price in shopPrices", () => {
    const state = makeTestState();
    const [newState] = enterHub(state, [], () => 0.5);

    for (const offers of Object.values(newState.hub!.freePickOffers)) {
      for (const p of offers) {
        expect(newState.hub!.shopPrices[p.id]).toBe(0);
      }
    }
  });

  test("initializes empty selections for all trainers", () => {
    const state = makeTestState();
    const [newState] = enterHub(state, [], () => 0.5);

    expect(newState.hub!.selections["t0"]).toEqual([]);
    expect(newState.hub!.selections["t1"]).toEqual([]);
  });

  test("emits hub_entered event", () => {
    const state = makeTestState();
    const [, events] = enterHub(state, [], () => 0.5);
    expect(events.some(e => e.type === "hub_entered")).toBe(true);
  });
});

// === handleSelectPokemon tests ===

describe("handleSelectPokemon", () => {
  test("trainer can select a free pick pokemon (emits pokemon_selected)", () => {
    const state = hubState();
    const freePick = state.hub!.freePickOffers["t0"][0];
    const [next, events] = handleSelectPokemon(state, { type: "select_pokemon", trainerId: "t0", pokemonId: freePick.id });

    expect(next.hub!.selections["t0"]).toContain(freePick.id);
    expect(events).toEqual([{ type: "pokemon_selected", trainerId: "t0", pokemonId: freePick.id }]);
  });

  test("trainer can select a shop pokemon (emits pokemon_selected)", () => {
    const state = hubState();
    const shopPokemon = state.hub!.shopPokemon[0];
    const [next, events] = handleSelectPokemon(state, { type: "select_pokemon", trainerId: "t0", pokemonId: shopPokemon.id });

    expect(next.hub!.selections["t0"]).toContain(shopPokemon.id);
    expect(events).toEqual([{ type: "pokemon_selected", trainerId: "t0", pokemonId: shopPokemon.id }]);
  });

  test("selecting again toggles off (emits pokemon_deselected)", () => {
    let state = hubState();
    const freePick = state.hub!.freePickOffers["t0"][0];
    [state] = handleSelectPokemon(state, { type: "select_pokemon", trainerId: "t0", pokemonId: freePick.id });
    expect(state.hub!.selections["t0"]).toContain(freePick.id);

    const [next, events] = handleSelectPokemon(state, { type: "select_pokemon", trainerId: "t0", pokemonId: freePick.id });
    expect(next.hub!.selections["t0"]).not.toContain(freePick.id);
    expect(events).toEqual([{ type: "pokemon_deselected", trainerId: "t0", pokemonId: freePick.id }]);
  });

  test("max 2 selections — third selection rejected", () => {
    let state = hubState();
    const free0 = state.hub!.freePickOffers["t0"][0];
    const free1 = state.hub!.freePickOffers["t0"][1];
    const shop0 = state.hub!.shopPokemon[0];

    [state] = handleSelectPokemon(state, { type: "select_pokemon", trainerId: "t0", pokemonId: free0.id });
    [state] = handleSelectPokemon(state, { type: "select_pokemon", trainerId: "t0", pokemonId: free1.id });
    expect(state.hub!.selections["t0"]).toHaveLength(2);

    const [next, events] = handleSelectPokemon(state, { type: "select_pokemon", trainerId: "t0", pokemonId: shop0.id });
    expect(next.hub!.selections["t0"]).toHaveLength(2);
    expect(events).toEqual([]);
  });

  test("rejected if trainer already confirmed", () => {
    let state = hubState();
    [state] = handleConfirmSelections(state, { type: "confirm_selections", trainerId: "t0" });

    const freePick = state.hub!.freePickOffers["t0"][0];
    const [, events] = handleSelectPokemon(state, { type: "select_pokemon", trainerId: "t0", pokemonId: freePick.id });
    expect(events).toEqual([]);
  });

  test("rejected if not enough currency for shop pick", () => {
    let state = hubState();
    // Set currency to 0
    state = {
      ...state,
      trainers: { ...state.trainers, t0: { ...state.trainers["t0"], currency: 0 } },
    };
    const shopPokemon = state.hub!.shopPokemon[0];
    const [, events] = handleSelectPokemon(state, { type: "select_pokemon", trainerId: "t0", pokemonId: shopPokemon.id });
    expect(events).toEqual([]);
  });

  test("rejected if pokemon not in free picks or shop (bogus id)", () => {
    const state = hubState();
    const [, events] = handleSelectPokemon(state, { type: "select_pokemon", trainerId: "t0", pokemonId: "bogus_id_xyz" });
    expect(events).toEqual([]);
  });

  test("currency check accounts for already-selected shop picks", () => {
    let state = hubState();
    const shop0 = state.hub!.shopPokemon[0];
    const shop1 = state.hub!.shopPokemon[1];
    const price0 = state.hub!.shopPrices[shop0.id];
    const price1 = state.hub!.shopPrices[shop1.id];

    // Set currency to exactly afford shop0 but not shop0 + shop1
    state = {
      ...state,
      trainers: { ...state.trainers, t0: { ...state.trainers["t0"], currency: price0 + price1 - 1 } },
    };

    [state] = handleSelectPokemon(state, { type: "select_pokemon", trainerId: "t0", pokemonId: shop0.id });
    expect(state.hub!.selections["t0"]).toContain(shop0.id);

    const [next, events] = handleSelectPokemon(state, { type: "select_pokemon", trainerId: "t0", pokemonId: shop1.id });
    expect(next.hub!.selections["t0"]).not.toContain(shop1.id);
    expect(events).toEqual([]);
  });
});

// === handleConfirmSelections tests ===

describe("handleConfirmSelections", () => {
  test("confirming adds selected pokemon to deck", () => {
    let state = hubState();
    const freePick = state.hub!.freePickOffers["t0"][0];
    [state] = handleSelectPokemon(state, { type: "select_pokemon", trainerId: "t0", pokemonId: freePick.id });

    const deckBefore = state.trainers["t0"].deck.drawPile.length + state.trainers["t0"].deck.discard.length;
    const [next] = handleConfirmSelections(state, { type: "confirm_selections", trainerId: "t0" });
    const deckAfter = next.trainers["t0"].deck.drawPile.length + next.trainers["t0"].deck.discard.length;

    expect(deckAfter).toBe(deckBefore + 1);
  });

  test("deducts currency for shop picks only (free picks cost nothing)", () => {
    let state = hubState();
    const freePick = state.hub!.freePickOffers["t0"][0];
    const shopPick = state.hub!.shopPokemon[0];
    const shopPrice = state.hub!.shopPrices[shopPick.id];

    [state] = handleSelectPokemon(state, { type: "select_pokemon", trainerId: "t0", pokemonId: freePick.id });
    [state] = handleSelectPokemon(state, { type: "select_pokemon", trainerId: "t0", pokemonId: shopPick.id });

    const currencyBefore = state.trainers["t0"].currency;
    const [next] = handleConfirmSelections(state, { type: "confirm_selections", trainerId: "t0" });

    expect(next.trainers["t0"].currency).toBe(currencyBefore - shopPrice);
  });

  test("confirming with 0 selections is valid (skip)", () => {
    const state = hubState();
    const currencyBefore = state.trainers["t0"].currency;
    const deckBefore = state.trainers["t0"].deck.drawPile.length + state.trainers["t0"].deck.discard.length;

    const [next, events] = handleConfirmSelections(state, { type: "confirm_selections", trainerId: "t0" });

    expect(next.trainers["t0"].currency).toBe(currencyBefore);
    const deckAfter = next.trainers["t0"].deck.drawPile.length + next.trainers["t0"].deck.discard.length;
    expect(deckAfter).toBe(deckBefore);
    expect(next.hub!.confirmedTrainers).toContain("t0");
    expect(events.some(e => e.type === "selections_confirmed")).toBe(true);
  });

  test("all trainers confirming transitions to world phase", () => {
    let state = hubState();
    [state] = handleConfirmSelections(state, { type: "confirm_selections", trainerId: "t0" });
    const [next, events] = handleConfirmSelections(state, { type: "confirm_selections", trainerId: "t1" });

    expect(next.phase).toBe("world");
    expect(next.hub).toBeNull();
    expect(next.votes).toEqual({});
    expect(events.some(e => e.type === "all_ready")).toBe(true);
    expect(events.some(e => e.type === "world_entered")).toBe(true);
  });

  test("rejected if already confirmed", () => {
    let state = hubState();
    [state] = handleConfirmSelections(state, { type: "confirm_selections", trainerId: "t0" });
    const [, events] = handleConfirmSelections(state, { type: "confirm_selections", trainerId: "t0" });
    expect(events).toEqual([]);
  });

  test("shop pokemon get unique ID (bought_${id}_${trainerId})", () => {
    let state = hubState();
    const shopPick = state.hub!.shopPokemon[0];
    [state] = handleSelectPokemon(state, { type: "select_pokemon", trainerId: "t0", pokemonId: shopPick.id });
    const [next] = handleConfirmSelections(state, { type: "confirm_selections", trainerId: "t0" });

    const allCards = [...next.trainers["t0"].deck.drawPile, ...next.trainers["t0"].deck.discard];
    const boughtCard = allCards.find(p => p.id === `bought_${shopPick.id}_t0`);
    expect(boughtCard).toBeDefined();
  });

  test("emits selections_confirmed event", () => {
    const state = hubState();
    const [, events] = handleConfirmSelections(state, { type: "confirm_selections", trainerId: "t0" });
    expect(events.some(e => e.type === "selections_confirmed")).toBe(true);
  });
});

// === Integration: full flow ===

describe("full flow: stop → hub → select → confirm → world", () => {
  test("complete cycle: stop -> hub -> select pokemon -> confirm -> world", () => {
    let state = createInitialState("TEST");
    [state] = resolveAction(state, { type: "join_game", trainerName: "T0", sessionToken: "t0" });
    [state] = resolveAction(state, { type: "join_game", trainerName: "T1", sessionToken: "t1" });
    [state] = resolveAction(state, { type: "start_game", trainerId: "t0" });
    expect(state.phase).toBe("route");

    // Both trainers stop
    [state] = resolveAction(state, { type: "stop", trainerId: "t0" });
    [state] = resolveAction(state, { type: "stop", trainerId: "t1" });
    expect(state.phase).toBe("hub");
    expect(state.hub).not.toBeNull();

    // Trainer 0 selects a free pick
    const offer0 = state.hub!.freePickOffers["t0"][0]?.id;
    if (offer0) {
      [state] = resolveAction(state, { type: "select_pokemon", trainerId: "t0", pokemonId: offer0 });
      expect(state.hub!.selections["t0"]).toContain(offer0);
    }

    // Both trainers confirm
    [state] = resolveAction(state, { type: "confirm_selections", trainerId: "t0" });
    [state] = resolveAction(state, { type: "confirm_selections", trainerId: "t1" });

    expect(state.phase).toBe("world");
    expect(state.hub).toBeNull();
    expect(state.votes).toEqual({});
  });
});

// === Hub Pricing ===

describe("hub pricing", () => {
  test("common basic = 2", () => {
    const p = createPokemon("charmander");
    expect(pokemonPrice(p)).toBe(2);
  });

  test("common stage1 = 4", () => {
    const p = createPokemon("charmeleon");
    expect(pokemonPrice(p)).toBe(4);
  });

  test("common stage2 = 7", () => {
    const p = createPokemon("charizard");
    expect(pokemonPrice(p)).toBe(7);
  });

  test("uncommon basic = 3", () => {
    const p = createPokemon("sneasel");
    expect(pokemonPrice(p)).toBe(3);
  });

  test("uncommon stage1 = 5", () => {
    const p = createPokemon("weavile");
    expect(pokemonPrice(p)).toBe(5);
  });

  test("rare basic = 5", () => {
    const p = createPokemon("snorlax");
    expect(pokemonPrice(p)).toBe(5);
  });

  test("legendary basic = 8", () => {
    const p = createPokemon("mewtwo");
    expect(pokemonPrice(p)).toBe(8);
  });
});
