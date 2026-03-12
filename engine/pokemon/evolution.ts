import type { Deck, Pokemon } from "../types";
import { getTemplate } from "./catalog";

export interface EvolutionEvent {
  readonly pokemonId: string;
  readonly fromTemplateId: string;
  readonly toTemplateId: string;
  readonly fromName: string;
  readonly toName: string;
}

function evolvePokemon(
  pokemon: Pokemon,
  draftedAtTier: Record<string, number>,
  currentTier: number,
): [Pokemon, EvolutionEvent | null] {
  if (!pokemon.evolvesInto || pokemon.evolutionSpeed === null) return [pokemon, null];
  const draftTier = draftedAtTier[pokemon.id];
  if (draftTier === undefined) return [pokemon, null];
  if (currentTier - draftTier < pokemon.evolutionSpeed) return [pokemon, null];

  const toTemplateId = pokemon.evolvesInto;
  const template = getTemplate(toTemplateId);

  const evolved: Pokemon = {
    id: pokemon.id,
    templateId: toTemplateId,
    name: template.name,
    types: template.types,
    distance: template.distance,
    cost: template.cost,
    moves: template.moves,
    rarity: template.rarity,
    description: template.description,
    stage: template.stage,
    evolutionLine: template.evolutionLine,
    evolvesInto: template.evolvesInto,
    evolutionSpeed: template.evolutionSpeed,
  };

  const event: EvolutionEvent = {
    pokemonId: pokemon.id,
    fromTemplateId: pokemon.templateId,
    toTemplateId,
    fromName: pokemon.name,
    toName: template.name,
  };

  return [evolved, event];
}

function evolvePile(
  pile: readonly Pokemon[],
  draftedAtTier: Record<string, number>,
  currentTier: number,
  newDraftedAtTier: Record<string, number>,
  events: EvolutionEvent[],
): readonly Pokemon[] {
  return pile.map((pokemon) => {
    const [evolved, event] = evolvePokemon(pokemon, draftedAtTier, currentTier);
    if (event) {
      newDraftedAtTier[pokemon.id] = currentTier;
      events.push(event);
    }
    return evolved;
  });
}

export function evolveDeck(
  deck: Deck,
  draftedAtTier: Record<string, number>,
  currentTier: number,
): [Deck, Record<string, number>, EvolutionEvent[]] {
  const newDraftedAtTier = { ...draftedAtTier };
  const events: EvolutionEvent[] = [];

  const drawPile = evolvePile(deck.drawPile, draftedAtTier, currentTier, newDraftedAtTier, events);
  const drawn = evolvePile(deck.drawn, draftedAtTier, currentTier, newDraftedAtTier, events);
  const discard = evolvePile(deck.discard, draftedAtTier, currentTier, newDraftedAtTier, events);

  return [{ drawPile, drawn, discard }, newDraftedAtTier, events];
}
