import { describe, test, expect } from "vitest";
import type { GameState, HubState, Trainer, RouteNode, WorldMap, Pokemon } from "../types";
import { createInitialState } from "../index";
import { resolveAction } from "../action-resolver";
import { enterHub, handlePickFreePokemon, handleSkipFreePick, handleBuyPokemon, handleReadyUp } from "../phases/hub";

// === Helpers ===

function makeTestState(opts: { bustedTrainers?: string[] } = {}): GameState {
  let state = createInitialState("TEST");
  [state] = resolveAction(state, { type: "join_game", trainerName: "T0", sessionToken: "t0" });
  [state] = resolveAction(state, { type: "join_game", trainerName: "T1", sessionToken: "t1" });

  const trainers: Record<string, Trainer> = {};
  for (const [id, t] of Object.entries(state.trainers)) {
    trainers[id] = { ...t, status: "waiting", currency: 10 };
  }

  const node: RouteNode = {
    id: "node1", type: "route", bonus: null, name: "Test Route", tier: 1,
    connections: ["node2"], modifiers: [], visited: true,
    pokemonPool: ["charmeleon", "graveler", "wartortle", "haunter", "swellow", "snorlax"],
  };

  const map: WorldMap = {
    nodes: { node1: node, node2: { ...node, id: "node2", visited: false } },
    currentNodeId: "node1",
    totalTiers: 8,
  };

  return { ...state, phase: "route" as const, trainers, map };
}

// === enterHub tests ===

describe("enterHub", () => {
  test("creates hub state with free pick offers for non-busted trainers", () => {
    const state = makeTestState();
    const [newState, events] = enterHub(state, [], () => 0.5);

    expect(newState.phase).toBe("hub");
    expect(newState.hub).not.toBeNull();
    expect(newState.hub!.phase).toBe("free_pick");
    expect(newState.hub!.freePickOffers["t0"]).toHaveLength(2);
    expect(newState.hub!.freePickOffers["t1"]).toHaveLength(2);
  });

  test("busted trainers get empty free pick offers", () => {
    const state = makeTestState();
    const [newState] = enterHub(state, ["t0"], () => 0.5);

    expect(newState.hub!.freePickOffers["t0"]).toHaveLength(0);
    expect(newState.hub!.freePickOffers["t1"]).toHaveLength(2);
    expect(newState.hub!.freePicksMade["t0"]).toBeNull();
  });

  test("generates shared shop with tier-scaled pokemon", () => {
    const state = makeTestState();
    const [newState] = enterHub(state, [], () => 0.5);

    expect(newState.hub!.shopPokemon.length).toBeGreaterThanOrEqual(3);
    expect(newState.hub!.shopPokemon.length).toBeLessThanOrEqual(5);
    for (const c of newState.hub!.shopPokemon) {
      expect(newState.hub!.shopPrices[c.id]).toBeDefined();
      expect(newState.hub!.shopPrices[c.id]).toBeGreaterThan(0);
    }
  });

  test("emits hub_entered event", () => {
    const state = makeTestState();
    const [, events] = enterHub(state, [], () => 0.5);
    expect(events.some(e => e.type === "hub_entered")).toBe(true);
  });

  test("if all trainers busted, skips free_pick and goes straight to marketplace", () => {
    const state = makeTestState();
    const [newState] = enterHub(state, ["t0", "t1"], () => 0.5);
    expect(newState.hub!.phase).toBe("marketplace");
  });
});

// === handlePickFreePokemon tests ===

describe("handlePickFreePokemon", () => {
  function hubState(): GameState {
    const state = makeTestState();
    const [entered] = enterHub(state, [], () => 0.5);
    return entered;
  }

  test("trainer picks one of their offered pokemon", () => {
    const state = hubState();
    const offeredId = state.hub!.freePickOffers["t0"][0].id;
    const [next, events] = handlePickFreePokemon(state, { type: "pick_free_pokemon", trainerId: "t0", pokemonId: offeredId });

    expect(next.hub!.freePicksMade["t0"]).toBe(offeredId);
    expect(events.some(e => e.type === "free_pokemon_picked")).toBe(true);
  });

  test("pokemon is added to trainer deck", () => {
    const state = hubState();
    const offeredId = state.hub!.freePickOffers["t0"][0].id;
    const deckSizeBefore = state.trainers["t0"].deck.drawPile.length + state.trainers["t0"].deck.discard.length;
    const [next] = handlePickFreePokemon(state, { type: "pick_free_pokemon", trainerId: "t0", pokemonId: offeredId });

    const deckSizeAfter = next.trainers["t0"].deck.drawPile.length + next.trainers["t0"].deck.discard.length;
    expect(deckSizeAfter).toBe(deckSizeBefore + 1);
  });

  test("rejected if pokemon not in offers", () => {
    const state = hubState();
    const [, events] = handlePickFreePokemon(state, { type: "pick_free_pokemon", trainerId: "t0", pokemonId: "bogus" });
    expect(events).toEqual([]);
  });

  test("rejected if trainer already picked", () => {
    let state = hubState();
    const offeredId = state.hub!.freePickOffers["t0"][0].id;
    [state] = handlePickFreePokemon(state, { type: "pick_free_pokemon", trainerId: "t0", pokemonId: offeredId });
    const [, events] = handlePickFreePokemon(state, { type: "pick_free_pokemon", trainerId: "t0", pokemonId: offeredId });
    expect(events).toEqual([]);
  });

  test("when all trainers have picked, transitions to marketplace phase", () => {
    let state = hubState();
    const offer0 = state.hub!.freePickOffers["t0"][0].id;
    const offer1 = state.hub!.freePickOffers["t1"][0].id;
    [state] = handlePickFreePokemon(state, { type: "pick_free_pokemon", trainerId: "t0", pokemonId: offer0 });
    const [next, events] = handlePickFreePokemon(state, { type: "pick_free_pokemon", trainerId: "t1", pokemonId: offer1 });

    expect(next.hub!.phase).toBe("marketplace");
    expect(events.some(e => e.type === "marketplace_opened")).toBe(true);
  });
});

// === handleSkipFreePick tests ===

describe("handleSkipFreePick", () => {
  function hubState(): GameState {
    const state = makeTestState();
    const [entered] = enterHub(state, [], () => 0.5);
    return entered;
  }

  test("trainer can skip their free pick", () => {
    const state = hubState();
    const [next, events] = handleSkipFreePick(state, { type: "skip_free_pick", trainerId: "t0" });

    expect(next.hub!.freePicksMade["t0"]).toBeNull();
    expect(events.some(e => e.type === "free_pick_skipped")).toBe(true);
  });

  test("deck unchanged after skip", () => {
    const state = hubState();
    const deckBefore = state.trainers["t0"].deck;
    const [next] = handleSkipFreePick(state, { type: "skip_free_pick", trainerId: "t0" });
    expect(next.trainers["t0"].deck).toEqual(deckBefore);
  });
});

// === handleBuyPokemon tests ===

describe("handleBuyPokemon", () => {
  function marketplaceState(): GameState {
    const state = makeTestState();
    const [entered] = enterHub(state, ["t0", "t1"], () => 0.5);
    return entered;
  }

  test("trainer buys a pokemon from the shop", () => {
    const state = marketplaceState();
    const shopPokemon = state.hub!.shopPokemon[0];
    const price = state.hub!.shopPrices[shopPokemon.id];
    const currencyBefore = state.trainers["t0"].currency;

    const [next, events] = handleBuyPokemon(state, { type: "buy_pokemon", trainerId: "t0", pokemonId: shopPokemon.id });

    expect(next.trainers["t0"].currency).toBe(currencyBefore - price);
    expect(events.some(e => e.type === "pokemon_purchased")).toBe(true);
  });

  test("pokemon added to trainer deck", () => {
    const state = marketplaceState();
    const shopPokemon = state.hub!.shopPokemon[0];
    const deckSizeBefore = state.trainers["t0"].deck.drawPile.length + state.trainers["t0"].deck.discard.length;

    const [next] = handleBuyPokemon(state, { type: "buy_pokemon", trainerId: "t0", pokemonId: shopPokemon.id });
    const deckSizeAfter = next.trainers["t0"].deck.drawPile.length + next.trainers["t0"].deck.discard.length;
    expect(deckSizeAfter).toBe(deckSizeBefore + 1);
  });

  test("rejected if not enough currency", () => {
    let state = marketplaceState();
    state = {
      ...state,
      trainers: { ...state.trainers, t0: { ...state.trainers["t0"], currency: 0 } },
    };
    const shopPokemon = state.hub!.shopPokemon[0];
    const [, events] = handleBuyPokemon(state, { type: "buy_pokemon", trainerId: "t0", pokemonId: shopPokemon.id });
    expect(events).toEqual([]);
  });

  test("rejected if pokemon not in shop", () => {
    const state = marketplaceState();
    const [, events] = handleBuyPokemon(state, { type: "buy_pokemon", trainerId: "t0", pokemonId: "bogus" });
    expect(events).toEqual([]);
  });

  test("rejected if not in marketplace sub-phase", () => {
    const state = makeTestState();
    const [entered] = enterHub(state, [], () => 0.5);
    expect(entered.hub!.phase).toBe("free_pick");

    const shopPokemon = entered.hub!.shopPokemon[0];
    const [, events] = handleBuyPokemon(entered, { type: "buy_pokemon", trainerId: "t0", pokemonId: shopPokemon.id });
    expect(events).toEqual([]);
  });

  test("unlimited stock — same pokemon can be bought by multiple trainers", () => {
    const state = marketplaceState();
    const shopPokemon = state.hub!.shopPokemon[0];
    let next = state;
    [next] = handleBuyPokemon(next, { type: "buy_pokemon", trainerId: "t0", pokemonId: shopPokemon.id });
    const [, events] = handleBuyPokemon(next, { type: "buy_pokemon", trainerId: "t1", pokemonId: shopPokemon.id });
    expect(events.some(e => e.type === "pokemon_purchased")).toBe(true);
  });
});

// === handleReadyUp tests ===

describe("handleReadyUp", () => {
  function marketplaceState(): GameState {
    const state = makeTestState();
    const [entered] = enterHub(state, ["t0", "t1"], () => 0.5);
    return entered;
  }

  test("trainer readies up", () => {
    const state = marketplaceState();
    const [next] = handleReadyUp(state, { type: "ready_up", trainerId: "t0" });
    expect(next.hub!.readyTrainers).toContain("t0");
  });

  test("rejected if not in marketplace sub-phase", () => {
    const state = makeTestState();
    const [entered] = enterHub(state, [], () => 0.5);
    const [, events] = handleReadyUp(entered, { type: "ready_up", trainerId: "t0" });
    expect(events).toEqual([]);
  });

  test("all trainers ready transitions to world phase", () => {
    let state = marketplaceState();
    [state] = handleReadyUp(state, { type: "ready_up", trainerId: "t0" });
    const [next, events] = handleReadyUp(state, { type: "ready_up", trainerId: "t1" });

    expect(next.phase).toBe("world");
    expect(next.hub).toBeNull();
    expect(next.votes).toEqual({});
    expect(events.some(e => e.type === "all_ready")).toBe(true);
    expect(events.some(e => e.type === "world_entered")).toBe(true);
  });
});

// === Integration: full flow ===

describe("full flow: route → hub → world", () => {
  test("complete cycle: stop → hub free pick → marketplace ready → world vote", () => {
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
    expect(state.hub!.phase).toBe("free_pick");

    // Both trainers pick free pokemon (or skip if none available)
    const offer0 = state.hub!.freePickOffers["t0"][0]?.id;
    const offer1 = state.hub!.freePickOffers["t1"][0]?.id;
    if (offer0) [state] = resolveAction(state, { type: "pick_free_pokemon", trainerId: "t0", pokemonId: offer0 });
    else [state] = resolveAction(state, { type: "skip_free_pick", trainerId: "t0" });
    if (offer1) [state] = resolveAction(state, { type: "pick_free_pokemon", trainerId: "t1", pokemonId: offer1 });
    else [state] = resolveAction(state, { type: "skip_free_pick", trainerId: "t1" });

    expect(state.hub!.phase).toBe("marketplace");

    // Both trainers ready up
    [state] = resolveAction(state, { type: "ready_up", trainerId: "t0" });
    [state] = resolveAction(state, { type: "ready_up", trainerId: "t1" });

    expect(state.phase).toBe("world");
    expect(state.hub).toBeNull();
    expect(state.votes).toEqual({});
  });
});
