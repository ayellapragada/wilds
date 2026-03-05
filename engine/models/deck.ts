import type { Card, Deck } from "../types";

export function createDeck(cards: Card[]): Deck {
  return {
    drawPile: shuffle([...cards]),
    drawn: [],
    discard: [],
  };
}

export function drawCard(deck: Deck): [Deck, Card] | null {
  let drawPile = [...deck.drawPile];
  let discard = [...deck.discard];

  // Reshuffle if empty
  if (drawPile.length === 0) {
    if (discard.length === 0) return null;
    drawPile = shuffle([...discard]);
    discard = [];
  }

  const card = drawPile[0];
  return [
    {
      drawPile: drawPile.slice(1),
      drawn: [...deck.drawn, card],
      discard,
    },
    card,
  ];
}

export function endTurn(deck: Deck): Deck {
  return {
    drawPile: deck.drawPile,
    drawn: [],
    discard: [...deck.discard, ...deck.drawn],
  };
}

export function addCard(deck: Deck, card: Card): Deck {
  return {
    ...deck,
    discard: [...deck.discard, card],
  };
}

export function removeCard(deck: Deck, cardId: string): Deck {
  return {
    drawPile: deck.drawPile.filter(c => c.id !== cardId),
    drawn: deck.drawn.filter(c => c.id !== cardId),
    discard: deck.discard.filter(c => c.id !== cardId),
  };
}

export function deckSize(deck: Deck): number {
  return deck.drawPile.length + deck.drawn.length + deck.discard.length;
}

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
