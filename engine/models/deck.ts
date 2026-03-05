import type { Creature, Deck } from "../types";

export function createDeck(creatures: Creature[]): Deck {
  return {
    drawPile: shuffle([...creatures]),
    drawn: [],
    discard: [],
  };
}

export function drawCreature(deck: Deck): [Deck, Creature] | null {
  let drawPile = [...deck.drawPile];
  let discard = [...deck.discard];

  // Reshuffle if empty
  if (drawPile.length === 0) {
    if (discard.length === 0) return null;
    drawPile = shuffle([...discard]);
    discard = [];
  }

  const creature = drawPile[0];
  return [
    {
      drawPile: drawPile.slice(1),
      drawn: [...deck.drawn, creature],
      discard,
    },
    creature,
  ];
}

export function endTurn(deck: Deck): Deck {
  return {
    drawPile: deck.drawPile,
    drawn: [],
    discard: [...deck.discard, ...deck.drawn],
  };
}

export function addCreature(deck: Deck, creature: Creature): Deck {
  return {
    ...deck,
    discard: [...deck.discard, creature],
  };
}

export function removeCreature(deck: Deck, creatureId: string): Deck {
  return {
    drawPile: deck.drawPile.filter(c => c.id !== creatureId),
    drawn: deck.drawn.filter(c => c.id !== creatureId),
    discard: deck.discard.filter(c => c.id !== creatureId),
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
