import { describe, it, expect, beforeEach } from "vitest";
import { evolveDeck, type EvolutionEvent } from "../pokemon/evolution";
import { createPokemon, resetPokemonIdCounter } from "../pokemon/catalog";
import { createDeck } from "../models/deck";
import type { Deck } from "../types";

beforeEach(() => {
  resetPokemonIdCounter();
});

describe("evolveDeck", () => {
  it("evolves a basic pokemon after enough tiers", () => {
    const charmander = createPokemon("charmander");
    const deck: Deck = { drawPile: [charmander], drawn: [], discard: [] };
    const draftedAtTier: Record<string, number> = { [charmander.id]: 1 };

    const [newDeck, newDraftedAtTier, events] = evolveDeck(deck, draftedAtTier, 3);

    expect(newDeck.drawPile[0].templateId).toBe("charmeleon");
    expect(newDeck.drawPile[0].name).toBe("Charmeleon");
    expect(newDeck.drawPile[0].id).toBe(charmander.id);
    expect(newDraftedAtTier[charmander.id]).toBe(3);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      pokemonId: charmander.id,
      fromTemplateId: "charmander",
      toTemplateId: "charmeleon",
      fromName: "Charmander",
      toName: "Charmeleon",
    });
  });

  it("does NOT evolve if not enough tiers passed", () => {
    const charmander = createPokemon("charmander");
    const deck: Deck = { drawPile: [charmander], drawn: [], discard: [] };
    const draftedAtTier: Record<string, number> = { [charmander.id]: 1 };

    const [newDeck, newDraftedAtTier, events] = evolveDeck(deck, draftedAtTier, 2);

    expect(newDeck.drawPile[0].templateId).toBe("charmander");
    expect(newDraftedAtTier[charmander.id]).toBe(1);
    expect(events).toHaveLength(0);
  });

  it("does NOT evolve single-stage pokemon (snorlax)", () => {
    const snorlax = createPokemon("snorlax");
    const deck: Deck = { drawPile: [snorlax], drawn: [], discard: [] };
    const draftedAtTier: Record<string, number> = { [snorlax.id]: 1 };

    const [newDeck, _, events] = evolveDeck(deck, draftedAtTier, 10);

    expect(newDeck.drawPile[0].templateId).toBe("snorlax");
    expect(events).toHaveLength(0);
  });

  it("evolves pokemon in discard pile", () => {
    const charmander = createPokemon("charmander");
    const deck: Deck = { drawPile: [], drawn: [], discard: [charmander] };
    const draftedAtTier: Record<string, number> = { [charmander.id]: 1 };

    const [newDeck, _, events] = evolveDeck(deck, draftedAtTier, 3);

    expect(newDeck.discard[0].templateId).toBe("charmeleon");
    expect(newDeck.discard[0].id).toBe(charmander.id);
    expect(events).toHaveLength(1);
  });

  it("does NOT evolve duds", () => {
    const dud = createPokemon("minor_dud");
    const deck: Deck = { drawPile: [dud], drawn: [], discard: [] };
    const draftedAtTier: Record<string, number> = { [dud.id]: 1 };

    const [newDeck, _, events] = evolveDeck(deck, draftedAtTier, 10);

    expect(newDeck.drawPile[0].templateId).toBe("minor_dud");
    expect(events).toHaveLength(0);
  });

  it("evolves stage1 to stage2 with proper tier tracking", () => {
    const charmeleon = createPokemon("charmeleon");
    const deck: Deck = { drawPile: [charmeleon], drawn: [], discard: [] };
    const draftedAtTier: Record<string, number> = { [charmeleon.id]: 2 };

    const [newDeck, newDraftedAtTier, events] = evolveDeck(deck, draftedAtTier, 4);

    expect(newDeck.drawPile[0].templateId).toBe("charizard");
    expect(newDeck.drawPile[0].name).toBe("Charizard");
    expect(newDeck.drawPile[0].id).toBe(charmeleon.id);
    expect(newDeck.drawPile[0].stage).toBe("stage2");
    expect(newDraftedAtTier[charmeleon.id]).toBe(4);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      pokemonId: charmeleon.id,
      fromTemplateId: "charmeleon",
      toTemplateId: "charizard",
      fromName: "Charmeleon",
      toName: "Charizard",
    });
  });
});
