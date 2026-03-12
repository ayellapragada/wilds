import { describe, it, expect, beforeEach } from "vitest";
import { createDeck, drawPokemon, endTurn, addPokemon, removePokemon, deckSize } from "../models/deck";
import { createStarterTeam, resetPokemonIdCounter } from "../pokemon/catalog";

beforeEach(() => {
  resetPokemonIdCounter();
});

describe("Deck", () => {
  it("creates a deck with all pokemon in draw pile", () => {
    const pokemon = createStarterTeam();
    const deck = createDeck(pokemon);

    expect(deck.drawPile.length).toBe(10);
    expect(deck.drawn.length).toBe(0);
    expect(deck.discard.length).toBe(0);
    expect(deckSize(deck)).toBe(10);
  });

  it("draws a pokemon from the draw pile", () => {
    const pokemon = createStarterTeam();
    const deck = createDeck(pokemon);

    const result = drawPokemon(deck);
    expect(result).not.toBeNull();

    const [newDeck, drawnPokemon] = result!;
    expect(newDeck.drawPile.length).toBe(9);
    expect(newDeck.drawn.length).toBe(1);
    expect(newDeck.drawn[0]).toBe(drawnPokemon);
    expect(deckSize(newDeck)).toBe(10);
  });

  it("draws all pokemon from the deck", () => {
    const pokemon = createStarterTeam();
    let deck = createDeck(pokemon);

    for (let i = 0; i < 10; i++) {
      const result = drawPokemon(deck);
      expect(result).not.toBeNull();
      deck = result![0];
    }

    expect(deck.drawPile.length).toBe(0);
    expect(deck.drawn.length).toBe(10);
    expect(deck.discard.length).toBe(0);
  });

  it("reshuffles discard when draw pile is empty", () => {
    const pokemon = createStarterTeam();
    let deck = createDeck(pokemon);

    // Draw all 10 pokemon
    for (let i = 0; i < 10; i++) {
      deck = drawPokemon(deck)![0];
    }

    // End turn moves drawn to discard
    deck = endTurn(deck);
    expect(deck.discard.length).toBe(10);
    expect(deck.drawn.length).toBe(0);
    expect(deck.drawPile.length).toBe(0);

    // Draw again — should reshuffle from discard
    const result = drawPokemon(deck);
    expect(result).not.toBeNull();
    expect(result![0].drawPile.length).toBe(9);
    expect(result![0].discard.length).toBe(0);
  });

  it("returns null when no pokemon remain anywhere", () => {
    const deck = createDeck([]);
    expect(drawPokemon(deck)).toBeNull();
  });

  it("endTurn moves drawn to discard", () => {
    const pokemon = createStarterTeam();
    let deck = createDeck(pokemon);

    deck = drawPokemon(deck)![0];
    deck = drawPokemon(deck)![0];
    expect(deck.drawn.length).toBe(2);

    deck = endTurn(deck);
    expect(deck.drawn.length).toBe(0);
    expect(deck.discard.length).toBe(2);
    expect(deck.drawPile.length).toBe(8);
  });

  it("adds a pokemon to the discard pile", () => {
    const pokemon = createStarterTeam();
    const deck = createDeck(pokemon);
    const newPokemon = pokemon[0]; // reuse for simplicity

    const updated = addPokemon(deck, newPokemon);
    expect(updated.discard.length).toBe(1);
    expect(deckSize(updated)).toBe(11);
  });

  it("removes a pokemon from any pile", () => {
    const pokemon = createStarterTeam();
    let deck = createDeck(pokemon);

    // Draw a pokemon so we have pokemon in drawn pile
    const [newDeck, drawnPokemon] = drawPokemon(deck)!;
    deck = newDeck;

    // Remove the drawn pokemon
    deck = removePokemon(deck, drawnPokemon.id);
    expect(deck.drawn.length).toBe(0);
    expect(deckSize(deck)).toBe(9);
  });
});

describe("Bust detection", () => {
  it("accumulates cost across draws", () => {
    const pokemon = createStarterTeam();
    let deck = createDeck(pokemon);
    let totalCost = 0;

    for (let i = 0; i < 10; i++) {
      const result = drawPokemon(deck);
      if (!result) break;
      const [newDeck, drawnPokemon] = result;
      deck = newDeck;
      totalCost += drawnPokemon.cost;
    }

    // All 10 pokemon: 4×2(pidgey) + 2×3(rattata) + 1(magikarp) + 2 + 2 + 2 = 21
    expect(totalCost).toBe(21);
  });

  it("can bust when total cost exceeds threshold", () => {
    const pokemon = createStarterTeam();
    let deck = createDeck(pokemon);
    const bustThreshold = 10;
    let totalCost = 0;
    let busted = false;

    while (true) {
      const result = drawPokemon(deck);
      if (!result) break;
      const [newDeck, drawnPokemon] = result;
      deck = newDeck;
      totalCost += drawnPokemon.cost;
      if (totalCost > bustThreshold) {
        busted = true;
        break;
      }
    }

    // With threshold 10 and total possible cost 21, bust is possible
    expect(busted).toBe(true);
    expect(totalCost).toBeGreaterThan(bustThreshold);
  });
});

describe("Starter team composition", () => {
  it("has 10 pokemon total", () => {
    const pokemon = createStarterTeam();
    expect(pokemon.length).toBe(10);
  });

  it("has unique IDs for each pokemon", () => {
    const pokemon = createStarterTeam();
    const ids = pokemon.map(c => c.id);
    expect(new Set(ids).size).toBe(10);
  });

  it("has correct total distance and cost", () => {
    const pokemon = createStarterTeam();
    const totalDistance = pokemon.reduce((sum, c) => sum + c.distance, 0);
    const totalCost = pokemon.reduce((sum, c) => sum + c.cost, 0);
    // 4×2 + 2×3 + 1 + 1 + 1 + 1 = 18 distance
    expect(totalDistance).toBe(18);
    // 4×2 + 2×3 + 1 + 2 + 2 + 2 = 21 cost
    expect(totalCost).toBe(21);
  });
});
