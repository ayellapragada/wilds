import type { GameState, GameEvent, HubState, Creature } from "../types";
import { createCreature, getAllTemplateIds, getTemplate } from "../creatures/catalog";
import { addCreature } from "../models/deck";

type ResolveResult = [GameState, GameEvent[]];
type RngFn = () => number;

function buildRarityBuckets(allIds: string[]): Record<string, string[]> {
  const buckets: Record<string, string[]> = {};
  for (const id of allIds) {
    const rarity = getTemplate(id).rarity;
    (buckets[rarity] ??= []).push(id);
  }
  return buckets;
}

function pickByRarity(
  weights: Record<string, number>,
  buckets: Record<string, string[]>,
  allIds: string[],
  rng: RngFn,
): string {
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = rng() * totalWeight;
  let targetRarity = "common";
  for (const [rarity, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) { targetRarity = rarity; break; }
  }
  const candidates = buckets[targetRarity];
  return candidates?.length
    ? candidates[Math.floor(rng() * candidates.length)]
    : allIds[Math.floor(rng() * allIds.length)];
}

export function enterHub(
  state: GameState,
  bustedTrainerIds: string[],
  rng: RngFn,
): ResolveResult {
  const map = state.map!;
  const currentNode = map.nodes[map.currentNodeId];
  const trainerIds = Object.keys(state.trainers);
  const bustedSet = new Set(bustedTrainerIds);

  const freePickOffers: Record<string, readonly Creature[]> = {};
  const freePicksMade: Record<string, string | null> = {};

  for (const id of trainerIds) {
    if (bustedSet.has(id)) {
      freePickOffers[id] = [];
      freePicksMade[id] = null;
    } else {
      const pool = currentNode.creaturePool;
      if (pool.length >= 2) {
        const idx1 = Math.floor(rng() * pool.length);
        let idx2 = Math.floor(rng() * (pool.length - 1));
        if (idx2 >= idx1) idx2++;
        freePickOffers[id] = [createCreature(pool[idx1]), createCreature(pool[idx2])];
      } else if (pool.length === 1) {
        freePickOffers[id] = [createCreature(pool[0])];
      } else {
        freePickOffers[id] = [];
        freePicksMade[id] = null;
      }
    }
  }

  const shopCreatures = generateShopCreatures(currentNode.tier, map.totalTiers, rng);
  const shopPrices: Record<string, number> = {};
  for (const c of shopCreatures) {
    shopPrices[c.id] = creaturePrice(c);
  }

  const allBusted = trainerIds.every(id => bustedSet.has(id));

  const hub: HubState = {
    phase: allBusted ? "marketplace" : "free_pick",
    freePickOffers,
    freePicksMade,
    shopCreatures,
    shopPrices,
    readyTrainers: [],
  };

  const events: GameEvent[] = [
    {
      type: "hub_entered",
      freePickOffers,
      shopCreatures: [...shopCreatures],
      shopPrices: { ...shopPrices },
    },
  ];

  if (allBusted) {
    events.push({
      type: "marketplace_opened",
      availableCreatures: [...shopCreatures],
      prices: { ...shopPrices },
    });
  }

  return [{ ...state, phase: "hub", hub }, events];
}

export function handlePickFreeCreature(
  state: GameState,
  action: { type: "pick_free_creature"; trainerId: string; creatureId: string },
): ResolveResult {
  if (state.phase !== "hub" || !state.hub || state.hub.phase !== "free_pick") return [state, []];
  const trainer = state.trainers[action.trainerId];
  if (!trainer) return [state, []];
  if (action.trainerId in state.hub.freePicksMade) return [state, []];

  const offers = state.hub.freePickOffers[action.trainerId] ?? [];
  const creature = offers.find(c => c.id === action.creatureId);
  if (!creature) return [state, []];

  const newDeck = addCreature(trainer.deck, creature);

  const events: GameEvent[] = [
    { type: "free_creature_picked", trainerId: action.trainerId, creature },
  ];

  const freePicksMade = { ...state.hub.freePicksMade, [action.trainerId]: creature.id };
  const [hub, transitionEvents] = maybeTransitionToMarketplace(state, freePicksMade);
  events.push(...transitionEvents);

  return [{
    ...state,
    trainers: { ...state.trainers, [action.trainerId]: { ...trainer, deck: newDeck } },
    hub,
  }, events];
}

export function handleSkipFreePick(
  state: GameState,
  action: { type: "skip_free_pick"; trainerId: string },
): ResolveResult {
  if (state.phase !== "hub" || !state.hub || state.hub.phase !== "free_pick") return [state, []];
  if (!state.trainers[action.trainerId]) return [state, []];
  if (action.trainerId in state.hub.freePicksMade) return [state, []];

  const freePicksMade = { ...state.hub.freePicksMade, [action.trainerId]: null };
  const events: GameEvent[] = [
    { type: "free_pick_skipped", trainerId: action.trainerId },
  ];
  const [hub, transitionEvents] = maybeTransitionToMarketplace(state, freePicksMade);
  events.push(...transitionEvents);

  return [{ ...state, hub }, events];
}

export function handleBuyCreature(
  state: GameState,
  action: { type: "buy_creature"; trainerId: string; creatureId: string },
): ResolveResult {
  if (state.phase !== "hub" || !state.hub || state.hub.phase !== "marketplace") return [state, []];
  const trainer = state.trainers[action.trainerId];
  if (!trainer) return [state, []];

  const creature = state.hub.shopCreatures.find(c => c.id === action.creatureId);
  if (!creature) return [state, []];

  const price = state.hub.shopPrices[creature.id];
  if (trainer.currency < price) return [state, []];

  const boughtCreature: Creature = { ...creature, id: `bought_${creature.id}_${trainer.id}` };
  const newDeck = addCreature(trainer.deck, boughtCreature);

  return [{
    ...state,
    trainers: {
      ...state.trainers,
      [action.trainerId]: { ...trainer, deck: newDeck, currency: trainer.currency - price },
    },
  }, [
    { type: "creature_purchased", trainerId: action.trainerId, creature: boughtCreature },
  ]];
}

export function handleReadyUp(
  state: GameState,
  action: { type: "ready_up"; trainerId: string },
): ResolveResult {
  if (state.phase !== "hub" || !state.hub || state.hub.phase !== "marketplace") return [state, []];
  if (!state.trainers[action.trainerId]) return [state, []];
  if (state.hub.readyTrainers.includes(action.trainerId)) return [state, []];

  const readyTrainers = [...state.hub.readyTrainers, action.trainerId];
  const events: GameEvent[] = [];

  const allReady = readyTrainers.length === Object.keys(state.trainers).length;

  if (allReady) {
    events.push({ type: "all_ready" });
    events.push({ type: "world_entered" });
    return [{
      ...state,
      phase: "world",
      hub: null,
      votes: {},
    }, events];
  }

  return [{
    ...state,
    hub: { ...state.hub, readyTrainers },
  }, events];
}

function maybeTransitionToMarketplace(
  state: GameState,
  freePicksMade: Record<string, string | null>,
): [HubState, GameEvent[]] {
  const hub = state.hub!;
  const allPicked = Object.keys(state.trainers).length === Object.keys(freePicksMade).length;
  if (allPicked) {
    return [
      { ...hub, freePicksMade, phase: "marketplace" },
      [{ type: "marketplace_opened", availableCreatures: [...hub.shopCreatures], prices: { ...hub.shopPrices } }],
    ];
  }
  return [{ ...hub, freePicksMade }, []];
}

function generateShopCreatures(tier: number, totalTiers: number, rng: RngFn): Creature[] {
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
    createCreature(pickByRarity(weights, buckets, allIds, rng))
  );
}

function creaturePrice(creature: Creature): number {
  const basePrices: Record<string, number> = {
    common: 2,
    uncommon: 4,
    rare: 7,
    legendary: 12,
  };
  return basePrices[creature.rarity] ?? 3;
}
