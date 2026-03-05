import type { Pokemon } from "../types";
import type { Move } from "../abilities/types";
import pokemonData from "./pokemon.json";

interface PokemonTemplate {
  name: string;
  types: Pokemon["types"];
  distance: number;
  cost: number;
  rarity: Pokemon["rarity"];
  description: string;
  moves: Move[];
}

const templates = pokemonData as Record<string, PokemonTemplate>;

let pokemonIdCounter = 0;

export function resetPokemonIdCounter() {
  pokemonIdCounter = 0;
}

export function createPokemon(templateId: string): Pokemon {
  const template = templates[templateId];
  if (!template) throw new Error(`Unknown pokemon template: ${templateId}`);
  return {
    id: `pokemon_${pokemonIdCounter++}`,
    templateId,
    name: template.name,
    types: template.types,
    distance: template.distance,
    cost: template.cost,
    rarity: template.rarity,
    description: template.description,
    moves: template.moves,
  };
}

export function getTemplate(templateId: string): PokemonTemplate {
  const template = templates[templateId];
  if (!template) throw new Error(`Unknown pokemon template: ${templateId}`);
  return template;
}

export function createStarterTeam(): Pokemon[] {
  return [
    ...Array.from({ length: 3 }, () => createPokemon("rattata")),
    ...Array.from({ length: 2 }, () => createPokemon("pidgey")),
    createPokemon("caterpie"),
    createPokemon("charmander"),
    createPokemon("squirtle"),
    createPokemon("bulbasaur"),
  ];
}

export function getAllTemplateIds(): string[] {
  return Object.keys(templates);
}
