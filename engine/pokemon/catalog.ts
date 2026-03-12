import type { Pokemon, EvolutionStage } from "../types";
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
  stage: EvolutionStage;
  evolutionLine: string;
  evolvesInto: string | null;
  evolutionSpeed: number | null;
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
    stage: template.stage,
    evolutionLine: template.evolutionLine,
    evolvesInto: template.evolvesInto,
    evolutionSpeed: template.evolutionSpeed,
  };
}

export function getTemplate(templateId: string): PokemonTemplate {
  const template = templates[templateId];
  if (!template) throw new Error(`Unknown pokemon template: ${templateId}`);
  return template;
}

export function createStarterTeam(): Pokemon[] {
  return [
    ...Array.from({ length: 4 }, () => createPokemon("pidgey")),
    ...Array.from({ length: 2 }, () => createPokemon("rattata")),
    createPokemon("magikarp"),
    createPokemon("charmander"),
    createPokemon("squirtle"),
    createPokemon("bulbasaur"),
  ];
}

export function isDud(templateId: string): boolean {
  return getTemplate(templateId).moves.length === 0;
}

export function getAllTemplateIds(): string[] {
  return Object.keys(templates);
}
