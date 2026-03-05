import { describe, it, expect, beforeEach } from "vitest";
import { createDeck, drawCard, endTurn, addCard, removeCard, deckSize } from "../models/deck";
import { createStarterDeck, resetCardIdCounter } from "../cards/catalog";

beforeEach(() => {
  resetCardIdCounter();
});

describe("Deck", () => {
  it("creates a deck with all cards in draw pile", () => {
    const cards = createStarterDeck();
    const deck = createDeck(cards);

    expect(deck.drawPile.length).toBe(9);
    expect(deck.drawn.length).toBe(0);
    expect(deck.discard.length).toBe(0);
    expect(deckSize(deck)).toBe(9);
  });

  it("draws a card from the draw pile", () => {
    const cards = createStarterDeck();
    const deck = createDeck(cards);

    const result = drawCard(deck);
    expect(result).not.toBeNull();

    const [newDeck, card] = result!;
    expect(newDeck.drawPile.length).toBe(8);
    expect(newDeck.drawn.length).toBe(1);
    expect(newDeck.drawn[0]).toBe(card);
    expect(deckSize(newDeck)).toBe(9);
  });

  it("draws all cards from the deck", () => {
    const cards = createStarterDeck();
    let deck = createDeck(cards);

    for (let i = 0; i < 9; i++) {
      const result = drawCard(deck);
      expect(result).not.toBeNull();
      deck = result![0];
    }

    expect(deck.drawPile.length).toBe(0);
    expect(deck.drawn.length).toBe(9);
    expect(deck.discard.length).toBe(0);
  });

  it("reshuffles discard when draw pile is empty", () => {
    const cards = createStarterDeck();
    let deck = createDeck(cards);

    // Draw all 9 cards
    for (let i = 0; i < 9; i++) {
      deck = drawCard(deck)![0];
    }

    // End turn moves drawn to discard
    deck = endTurn(deck);
    expect(deck.discard.length).toBe(9);
    expect(deck.drawn.length).toBe(0);
    expect(deck.drawPile.length).toBe(0);

    // Draw again — should reshuffle from discard
    const result = drawCard(deck);
    expect(result).not.toBeNull();
    expect(result![0].drawPile.length).toBe(8);
    expect(result![0].discard.length).toBe(0);
  });

  it("returns null when no cards remain anywhere", () => {
    const deck = createDeck([]);
    expect(drawCard(deck)).toBeNull();
  });

  it("endTurn moves drawn to discard", () => {
    const cards = createStarterDeck();
    let deck = createDeck(cards);

    deck = drawCard(deck)![0];
    deck = drawCard(deck)![0];
    expect(deck.drawn.length).toBe(2);

    deck = endTurn(deck);
    expect(deck.drawn.length).toBe(0);
    expect(deck.discard.length).toBe(2);
    expect(deck.drawPile.length).toBe(7);
  });

  it("adds a card to the discard pile", () => {
    const cards = createStarterDeck();
    const deck = createDeck(cards);
    const newCard = cards[0]; // reuse for simplicity

    const updated = addCard(deck, newCard);
    expect(updated.discard.length).toBe(1);
    expect(deckSize(updated)).toBe(10);
  });

  it("removes a card from any pile", () => {
    const cards = createStarterDeck();
    let deck = createDeck(cards);

    // Draw a card so we have cards in drawn pile
    const [newDeck, drawnCard] = drawCard(deck)!;
    deck = newDeck;

    // Remove the drawn card
    deck = removeCard(deck, drawnCard.id);
    expect(deck.drawn.length).toBe(0);
    expect(deckSize(deck)).toBe(8);
  });
});

describe("Bust detection", () => {
  it("accumulates cost across draws", () => {
    const cards = createStarterDeck();
    let deck = createDeck(cards);
    let totalCost = 0;

    for (let i = 0; i < 9; i++) {
      const result = drawCard(deck);
      if (!result) break;
      const [newDeck, card] = result;
      deck = newDeck;
      totalCost += card.cost;
    }

    // All 9 cards: 3×1 + 3×2 + 3 + 1 + 4 = 17
    expect(totalCost).toBe(17);
  });

  it("can bust when total cost exceeds threshold", () => {
    const cards = createStarterDeck();
    let deck = createDeck(cards);
    const bustThreshold = 10;
    let totalCost = 0;
    let busted = false;

    while (true) {
      const result = drawCard(deck);
      if (!result) break;
      const [newDeck, card] = result;
      deck = newDeck;
      totalCost += card.cost;
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

describe("Starter deck composition", () => {
  it("has 9 cards total", () => {
    const cards = createStarterDeck();
    expect(cards.length).toBe(9);
  });

  it("has unique IDs for each card", () => {
    const cards = createStarterDeck();
    const ids = cards.map(c => c.id);
    expect(new Set(ids).size).toBe(9);
  });

  it("has correct total distance and cost", () => {
    const cards = createStarterDeck();
    const totalDistance = cards.reduce((sum, c) => sum + c.distance, 0);
    const totalCost = cards.reduce((sum, c) => sum + c.cost, 0);
    // 3×1 + 3×2 + 3 + 2 + 3 = 17 distance
    expect(totalDistance).toBe(17);
    // 3×1 + 3×2 + 3 + 1 + 4 = 17 cost
    expect(totalCost).toBe(17);
  });
});
