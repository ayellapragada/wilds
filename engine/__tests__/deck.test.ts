import { describe, it, expect, beforeEach } from "vitest";
import { createDeck, drawCreature, endTurn, addCreature, removeCreature, deckSize } from "../models/deck";
import { createStarterTeam, resetCreatureIdCounter } from "../creatures/catalog";

beforeEach(() => {
  resetCreatureIdCounter();
});

describe("Deck", () => {
  it("creates a deck with all creatures in draw pile", () => {
    const creatures = createStarterTeam();
    const deck = createDeck(creatures);

    expect(deck.drawPile.length).toBe(9);
    expect(deck.drawn.length).toBe(0);
    expect(deck.discard.length).toBe(0);
    expect(deckSize(deck)).toBe(9);
  });

  it("draws a creature from the draw pile", () => {
    const creatures = createStarterTeam();
    const deck = createDeck(creatures);

    const result = drawCreature(deck);
    expect(result).not.toBeNull();

    const [newDeck, creature] = result!;
    expect(newDeck.drawPile.length).toBe(8);
    expect(newDeck.drawn.length).toBe(1);
    expect(newDeck.drawn[0]).toBe(creature);
    expect(deckSize(newDeck)).toBe(9);
  });

  it("draws all creatures from the deck", () => {
    const creatures = createStarterTeam();
    let deck = createDeck(creatures);

    for (let i = 0; i < 9; i++) {
      const result = drawCreature(deck);
      expect(result).not.toBeNull();
      deck = result![0];
    }

    expect(deck.drawPile.length).toBe(0);
    expect(deck.drawn.length).toBe(9);
    expect(deck.discard.length).toBe(0);
  });

  it("reshuffles discard when draw pile is empty", () => {
    const creatures = createStarterTeam();
    let deck = createDeck(creatures);

    // Draw all 9 creatures
    for (let i = 0; i < 9; i++) {
      deck = drawCreature(deck)![0];
    }

    // End turn moves drawn to discard
    deck = endTurn(deck);
    expect(deck.discard.length).toBe(9);
    expect(deck.drawn.length).toBe(0);
    expect(deck.drawPile.length).toBe(0);

    // Draw again — should reshuffle from discard
    const result = drawCreature(deck);
    expect(result).not.toBeNull();
    expect(result![0].drawPile.length).toBe(8);
    expect(result![0].discard.length).toBe(0);
  });

  it("returns null when no creatures remain anywhere", () => {
    const deck = createDeck([]);
    expect(drawCreature(deck)).toBeNull();
  });

  it("endTurn moves drawn to discard", () => {
    const creatures = createStarterTeam();
    let deck = createDeck(creatures);

    deck = drawCreature(deck)![0];
    deck = drawCreature(deck)![0];
    expect(deck.drawn.length).toBe(2);

    deck = endTurn(deck);
    expect(deck.drawn.length).toBe(0);
    expect(deck.discard.length).toBe(2);
    expect(deck.drawPile.length).toBe(7);
  });

  it("adds a creature to the discard pile", () => {
    const creatures = createStarterTeam();
    const deck = createDeck(creatures);
    const newCreature = creatures[0]; // reuse for simplicity

    const updated = addCreature(deck, newCreature);
    expect(updated.discard.length).toBe(1);
    expect(deckSize(updated)).toBe(10);
  });

  it("removes a creature from any pile", () => {
    const creatures = createStarterTeam();
    let deck = createDeck(creatures);

    // Draw a creature so we have creatures in drawn pile
    const [newDeck, drawnCreature] = drawCreature(deck)!;
    deck = newDeck;

    // Remove the drawn creature
    deck = removeCreature(deck, drawnCreature.id);
    expect(deck.drawn.length).toBe(0);
    expect(deckSize(deck)).toBe(8);
  });
});

describe("Bust detection", () => {
  it("accumulates cost across draws", () => {
    const creatures = createStarterTeam();
    let deck = createDeck(creatures);
    let totalCost = 0;

    for (let i = 0; i < 9; i++) {
      const result = drawCreature(deck);
      if (!result) break;
      const [newDeck, creature] = result;
      deck = newDeck;
      totalCost += creature.cost;
    }

    // All 9 creatures: 3×1 + 3×2 + 3 + 1 + 4 = 17
    expect(totalCost).toBe(17);
  });

  it("can bust when total cost exceeds threshold", () => {
    const creatures = createStarterTeam();
    let deck = createDeck(creatures);
    const bustThreshold = 10;
    let totalCost = 0;
    let busted = false;

    while (true) {
      const result = drawCreature(deck);
      if (!result) break;
      const [newDeck, creature] = result;
      deck = newDeck;
      totalCost += creature.cost;
      if (totalCost > bustThreshold) {
        busted = true;
        break;
      }
    }

    // With threshold 10 and total possible cost 17, bust is inevitable if you draw all
    expect(busted).toBe(true);
    expect(totalCost).toBeGreaterThan(bustThreshold);
  });
});

describe("Starter team composition", () => {
  it("has 9 creatures total", () => {
    const creatures = createStarterTeam();
    expect(creatures.length).toBe(9);
  });

  it("has unique IDs for each creature", () => {
    const creatures = createStarterTeam();
    const ids = creatures.map(c => c.id);
    expect(new Set(ids).size).toBe(9);
  });

  it("has correct total distance and cost", () => {
    const creatures = createStarterTeam();
    const totalDistance = creatures.reduce((sum, c) => sum + c.distance, 0);
    const totalCost = creatures.reduce((sum, c) => sum + c.cost, 0);
    // 3×1 + 3×2 + 3 + 2 + 3 = 17 distance
    expect(totalDistance).toBe(17);
    // 3×1 + 3×2 + 3 + 1 + 4 = 17 cost
    expect(totalCost).toBe(17);
  });
});
