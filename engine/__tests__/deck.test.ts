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

    expect(deck.drawPile.length).toBe(9);
    expect(deck.drawn.length).toBe(0);
    expect(deck.discard.length).toBe(0);
    expect(deckSize(deck)).toBe(9);
  });

  it("draws a pokemon from the draw pile", () => {
    const pokemon = createStarterTeam();
    const deck = createDeck(pokemon);

    const result = drawPokemon(deck);
    expect(result).not.toBeNull();

    const [newDeck, drawnPokemon] = result!;
    expect(newDeck.drawPile.length).toBe(8);
    expect(newDeck.drawn.length).toBe(1);
    expect(newDeck.drawn[0]).toBe(drawnPokemon);
    expect(deckSize(newDeck)).toBe(9);
  });

  it("draws all pokemon from the deck", () => {
    const pokemon = createStarterTeam();
    let deck = createDeck(pokemon);

    for (let i = 0; i < 9; i++) {
      const result = drawPokemon(deck);
      expect(result).not.toBeNull();
      deck = result![0];
    }

    expect(deck.drawPile.length).toBe(0);
    expect(deck.drawn.length).toBe(9);
    expect(deck.discard.length).toBe(0);
  });

  it("reshuffles discard when draw pile is empty", () => {
    const pokemon = createStarterTeam();
    let deck = createDeck(pokemon);

    // Draw all 9 pokemon
    for (let i = 0; i < 9; i++) {
      deck = drawPokemon(deck)![0];
    }

    // End turn moves drawn to discard
    deck = endTurn(deck);
    expect(deck.discard.length).toBe(9);
    expect(deck.drawn.length).toBe(0);
    expect(deck.drawPile.length).toBe(0);

    // Draw again — should reshuffle from discard
    const result = drawPokemon(deck);
    expect(result).not.toBeNull();
    expect(result![0].drawPile.length).toBe(8);
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
    expect(deck.drawPile.length).toBe(7);
  });

  it("adds a pokemon to the discard pile", () => {
    const pokemon = createStarterTeam();
    const deck = createDeck(pokemon);
    const newPokemon = pokemon[0]; // reuse for simplicity

    const updated = addPokemon(deck, newPokemon);
    expect(updated.discard.length).toBe(1);
    expect(deckSize(updated)).toBe(10);
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
    expect(deckSize(deck)).toBe(8);
  });
});

describe("Bust detection", () => {
  it("accumulates cost across draws", () => {
    const pokemon = createStarterTeam();
    let deck = createDeck(pokemon);
    let totalCost = 0;

    for (let i = 0; i < 9; i++) {
      const result = drawPokemon(deck);
      if (!result) break;
      const [newDeck, drawnPokemon] = result;
      deck = newDeck;
      totalCost += drawnPokemon.cost;
    }

    // All 9 pokemon: 3×1 + 2×1 + 1 + 3 + 2 + 2 = 13
    expect(totalCost).toBe(13);
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

    // With threshold 10 and total possible cost 11, bust is possible
    expect(busted).toBe(true);
    expect(totalCost).toBeGreaterThan(bustThreshold);
  });
});

describe("Starter team composition", () => {
  it("has 9 pokemon total", () => {
    const pokemon = createStarterTeam();
    expect(pokemon.length).toBe(9);
  });

  it("has unique IDs for each pokemon", () => {
    const pokemon = createStarterTeam();
    const ids = pokemon.map(c => c.id);
    expect(new Set(ids).size).toBe(9);
  });

  it("has correct total distance and cost", () => {
    const pokemon = createStarterTeam();
    const totalDistance = pokemon.reduce((sum, c) => sum + c.distance, 0);
    const totalCost = pokemon.reduce((sum, c) => sum + c.cost, 0);
    // 3×1 + 2×2 + 1 + 3 + 2 + 2 = 15 distance
    expect(totalDistance).toBe(15);
    // 3×1 + 2×1 + 1 + 3 + 2 + 2 = 13 cost
    expect(totalCost).toBe(13);
  });
});
