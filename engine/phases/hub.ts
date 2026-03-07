import type { GameState, GameEvent, HubState, Pokemon, ResolveResult, RngFn } from "../types";
import { createPokemon, getAllTemplateIds } from "../pokemon/catalog";
import { buildRarityBuckets, pickByRarity } from "../pokemon/rarity";
import { addPokemon } from "../models/deck";

export function enterHub(
  state: GameState,
  bustedTrainerIds: string[],
  rng: RngFn,
): ResolveResult {
  const map = state.map!;
  const currentNode = map.nodes[map.currentNodeId];
  const bustedSet = new Set(bustedTrainerIds);

  const freePickOffers: Record<string, readonly Pokemon[]> = {};
  for (const id of Object.keys(state.trainers)) {
    if (bustedSet.has(id)) {
      freePickOffers[id] = [];
    } else {
      const pool = currentNode.pokemonPool;
      if (pool.length >= 2) {
        const idx1 = Math.floor(rng() * pool.length);
        let idx2 = Math.floor(rng() * (pool.length - 1));
        if (idx2 >= idx1) idx2++;
        freePickOffers[id] = [createPokemon(pool[idx1]), createPokemon(pool[idx2])];
      } else if (pool.length === 1) {
        freePickOffers[id] = [createPokemon(pool[0])];
      } else {
        freePickOffers[id] = [];
      }
    }
  }

  const shopPokemon = generateShopPokemon(currentNode.tier, map.totalTiers, rng);
  const shopPrices: Record<string, number> = {};
  for (const p of shopPokemon) {
    shopPrices[p.id] = pokemonPrice(p);
  }
  for (const offers of Object.values(freePickOffers)) {
    for (const p of offers) {
      shopPrices[p.id] = 0;
    }
  }

  const selections: Record<string, readonly string[]> = {};
  for (const id of Object.keys(state.trainers)) {
    selections[id] = [];
  }

  const hub: HubState = {
    freePickOffers,
    shopPokemon,
    shopPrices,
    selections,
    confirmedTrainers: [],
  };

  const events: GameEvent[] = [
    {
      type: "hub_entered",
      freePickOffers,
      shopPokemon: [...shopPokemon],
      shopPrices: { ...shopPrices },
    },
  ];

  return [{ ...state, phase: "hub", hub }, events];
}

export function handleSelectPokemon(
  state: GameState,
  action: { type: "select_pokemon"; trainerId: string; pokemonId: string },
): ResolveResult {
  if (state.phase !== "hub" || !state.hub) return [state, []];
  const trainer = state.trainers[action.trainerId];
  if (!trainer) return [state, []];
  if (state.hub.confirmedTrainers.includes(action.trainerId)) return [state, []];

  const currentSelections = state.hub.selections[action.trainerId] ?? [];

  if (currentSelections.includes(action.pokemonId)) {
    const newSelections = currentSelections.filter(id => id !== action.pokemonId);
    return [{
      ...state,
      hub: {
        ...state.hub,
        selections: { ...state.hub.selections, [action.trainerId]: newSelections },
      },
    }, [{ type: "pokemon_deselected", trainerId: action.trainerId, pokemonId: action.pokemonId }]];
  }

  if (currentSelections.length >= 2) return [state, []];

  const freeOffers = state.hub.freePickOffers[action.trainerId] ?? [];
  const isFreePick = freeOffers.some(p => p.id === action.pokemonId);
  const isShopPokemon = state.hub.shopPokemon.some(p => p.id === action.pokemonId);
  if (!isFreePick && !isShopPokemon) return [state, []];

  if (isShopPokemon) {
    const price = state.hub.shopPrices[action.pokemonId] ?? 0;
    const alreadySpending = currentSelections.reduce((sum, id) => {
      return sum + (state.hub!.shopPrices[id] ?? 0);
    }, 0);
    if (trainer.currency < alreadySpending + price) return [state, []];
  }

  const newSelections = [...currentSelections, action.pokemonId];
  return [{
    ...state,
    hub: {
      ...state.hub,
      selections: { ...state.hub.selections, [action.trainerId]: newSelections },
    },
  }, [{ type: "pokemon_selected", trainerId: action.trainerId, pokemonId: action.pokemonId }]];
}

export function handleConfirmSelections(
  state: GameState,
  action: { type: "confirm_selections"; trainerId: string },
): ResolveResult {
  if (state.phase !== "hub" || !state.hub) return [state, []];
  const trainer = state.trainers[action.trainerId];
  if (!trainer) return [state, []];
  if (state.hub.confirmedTrainers.includes(action.trainerId)) return [state, []];

  const selectedIds = state.hub.selections[action.trainerId] ?? [];
  const freeOffers = state.hub.freePickOffers[action.trainerId] ?? [];

  let totalCost = 0;
  const selectedPokemon: Pokemon[] = [];
  for (const pokemonId of selectedIds) {
    const freePkmn = freeOffers.find(p => p.id === pokemonId);
    const shopPkmn = state.hub.shopPokemon.find(p => p.id === pokemonId);
    const pokemon = freePkmn ?? shopPkmn;
    if (!pokemon) return [state, []];

    const price = state.hub.shopPrices[pokemonId] ?? 0;
    totalCost += price;

    if (shopPkmn) {
      selectedPokemon.push({ ...shopPkmn, id: `bought_${shopPkmn.id}_${trainer.id}` });
    } else {
      selectedPokemon.push(pokemon);
    }
  }

  if (trainer.currency < totalCost) return [state, []];

  let newDeck = trainer.deck;
  for (const pokemon of selectedPokemon) {
    newDeck = addPokemon(newDeck, pokemon);
  }

  const confirmedTrainers = [...state.hub.confirmedTrainers, action.trainerId];
  const events: GameEvent[] = [
    { type: "selections_confirmed", trainerId: action.trainerId, pokemon: selectedPokemon },
  ];

  const allConfirmed = confirmedTrainers.length === Object.keys(state.trainers).length;
  if (allConfirmed) {
    events.push({ type: "all_ready" });
    events.push({ type: "world_entered" });
    return [{
      ...state,
      phase: "world",
      hub: null,
      votes: {},
      trainers: {
        ...state.trainers,
        [action.trainerId]: { ...trainer, deck: newDeck, currency: trainer.currency - totalCost },
      },
    }, events];
  }

  return [{
    ...state,
    trainers: {
      ...state.trainers,
      [action.trainerId]: { ...trainer, deck: newDeck, currency: trainer.currency - totalCost },
    },
    hub: { ...state.hub, confirmedTrainers },
  }, events];
}

function generateShopPokemon(tier: number, totalTiers: number, rng: RngFn): Pokemon[] {
  const allIds = getAllTemplateIds();
  const buckets = buildRarityBuckets(allIds);
  const shopSize = 3 + (rng() < 0.5 ? 1 : 0);
  const progress = tier / (totalTiers - 1);

  const weights: Record<string, number> = {
    common: Math.max(0.1, 0.8 - progress * 0.6),
    uncommon: 0.3 + progress * 0.2,
    rare: progress * 0.4,
    legendary: progress > 0.7 ? (progress - 0.7) * 0.8 : 0,
  };

  return Array.from({ length: shopSize }, () =>
    createPokemon(pickByRarity(weights, buckets, allIds, rng))
  );
}

function pokemonPrice(pokemon: Pokemon): number {
  const basePrices: Record<string, number> = {
    common: 2,
    uncommon: 4,
    rare: 7,
    legendary: 12,
  };
  return basePrices[pokemon.rarity] ?? 3;
}
