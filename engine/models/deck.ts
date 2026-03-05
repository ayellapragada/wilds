import type { Pokemon, Deck } from "../types";

export function createDeck(pokemon: Pokemon[]): Deck {
  return {
    drawPile: shuffle([...pokemon]),
    drawn: [],
    discard: [],
  };
}

export function drawPokemon(deck: Deck): [Deck, Pokemon] | null {
  let drawPile = [...deck.drawPile];
  let discard = [...deck.discard];

  if (drawPile.length === 0) {
    if (discard.length === 0) return null;
    drawPile = shuffle([...discard]);
    discard = [];
  }

  const pokemon = drawPile[0];
  return [
    {
      drawPile: drawPile.slice(1),
      drawn: [...deck.drawn, pokemon],
      discard,
    },
    pokemon,
  ];
}

export function endTurn(deck: Deck): Deck {
  return {
    drawPile: deck.drawPile,
    drawn: [],
    discard: [...deck.discard, ...deck.drawn],
  };
}

export function addPokemon(deck: Deck, pokemon: Pokemon): Deck {
  return {
    ...deck,
    discard: [...deck.discard, pokemon],
  };
}

export function removePokemon(deck: Deck, pokemonId: string): Deck {
  return {
    drawPile: deck.drawPile.filter(p => p.id !== pokemonId),
    drawn: deck.drawn.filter(p => p.id !== pokemonId),
    discard: deck.discard.filter(p => p.id !== pokemonId),
  };
}

export function deckSize(deck: Deck): number {
  return deck.drawPile.length + deck.drawn.length + deck.discard.length;
}

export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
