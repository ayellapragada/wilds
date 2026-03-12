import { describe, it, expect, beforeEach } from "vitest";
import { createPokemon, createStarterTeam, resetPokemonIdCounter } from "../pokemon/catalog";

beforeEach(() => resetPokemonIdCounter());

describe("new Pokemon type", () => {
  it("has evolution fields on a basic pokemon", () => {
    const pokemon = createPokemon("charmander");
    expect(pokemon.stage).toBe("basic");
    expect(pokemon.evolutionLine).toBe("charmander");
    expect(pokemon.evolvesInto).toBe("charmeleon");
    expect(pokemon.evolutionSpeed).toBe(2);
  });

  it("has no evolution on a single-stage pokemon", () => {
    const pokemon = createPokemon("snorlax");
    expect(pokemon.stage).toBe("basic");
    expect(pokemon.evolutionLine).toBe("snorlax");
    expect(pokemon.evolvesInto).toBeNull();
    expect(pokemon.evolutionSpeed).toBeNull();
  });

  it("creates a stage2 pokemon with no further evolution", () => {
    const pokemon = createPokemon("charizard");
    expect(pokemon.stage).toBe("stage2");
    expect(pokemon.evolutionLine).toBe("charmander");
    expect(pokemon.evolvesInto).toBeNull();
  });
});

describe("starter team", () => {
  it("creates 10 cards: 7 filler + 3 starters", () => {
    const team = createStarterTeam();
    expect(team).toHaveLength(10);

    const filler = team.filter(p => p.moves.length === 0);
    expect(filler).toHaveLength(7);

    const starters = team.filter(p => p.moves.length > 0);
    expect(starters).toHaveLength(3);
    expect(starters.map(s => s.templateId).sort()).toEqual(["bulbasaur", "charmander", "squirtle"]);
  });

  it("has correct filler distribution", () => {
    const team = createStarterTeam();
    const pidgeys = team.filter(p => p.templateId === "pidgey");
    const rattatas = team.filter(p => p.templateId === "rattata");
    const magikarps = team.filter(p => p.templateId === "magikarp");

    expect(pidgeys).toHaveLength(4);
    expect(rattatas).toHaveLength(2);
    expect(magikarps).toHaveLength(1);
  });

  it("starters cost 2 and have distance 1", () => {
    const team = createStarterTeam();
    const starters = team.filter(p => p.moves.length > 0);
    for (const s of starters) {
      expect(s.cost).toBe(2);
      expect(s.distance).toBe(1);
    }
  });
});
