# Card & Evolution System Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current 47-card catalog with a new system featuring compressed cost scale (0-3), keyword-based abilities (Momentum/Fury/Foresight/Echo/Overgrowth/Ramp/Shield/Armor/Broadcast/Hex), evolution lines, and broadcast player interaction.

**Architecture:** The engine stays pure. We modify types, rewrite the ability system to support new keywords, replace the pokemon catalog (JSON + catalog.ts), update the action resolver for Fury/Echo/Broadcast mechanics, and update hub pricing for rarity×stage. Evolution is tracked per-card and resolves between routes.

**Tech Stack:** TypeScript strict mode, Vitest for tests, pure functions, immutable state.

**Spec:** `docs/superpowers/specs/2026-03-11-card-design-spec.md`

---

## File Structure

```
engine/
├── types.ts                    — MODIFY: Add evolution fields to Pokemon, EvolutionStage type,
│                                  BroadcastEffect type, update Trainer for echo/broadcast state
├── abilities/
│   ├── types.ts                — MODIFY: Add new effect types (fury_draw, echo, armor,
│   │                              broadcast, reorder_deck), new conditions
│   └── resolver.ts             — MODIFY: Handle new effect types, expand resolver
├── pokemon/
│   ├── catalog.ts              — MODIFY: Add evolution support, new starter deck,
│   │                              evolution line registry
│   ├── pokemon.json            — REWRITE: New card catalog with all evolution lines
│   ├── rarity.ts               — MODIFY: Add stage-aware pool generation
│   └── evolution.ts            — CREATE: Evolution resolution logic
├── models/
│   └── broadcast.ts            — CREATE: Broadcast collapse resolution
├── phases/
│   └── hub.ts                  — MODIFY: New pricing matrix, busted players get 1 pick,
│                                  evolution trigger on hub entry
├── action-resolver.ts          — MODIFY: Fury draw loop, echo state tracking,
│                                  broadcast resolution on route end
├── __tests__/
│   ├── abilities.test.ts       — MODIFY: Add keyword-specific ability tests (file already exists)
│   ├── evolution.test.ts       — CREATE: Evolution system tests
│   ├── broadcast.test.ts       — CREATE: Broadcast collapse tests
│   ├── catalog.test.ts         — CREATE: New catalog validation tests
│   └── action-resolver.test.ts — MODIFY: Update for new mechanics
```

---

## Chunk 1: Types & Ability System Foundation

### Task 1: Update Core Types

**Files:**
- Modify: `engine/types.ts`
- Modify: `engine/abilities/types.ts`

- [ ] **Step 1: Write failing test for new Pokemon type shape**

Create `engine/__tests__/catalog.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createPokemon } from "../pokemon/catalog";

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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run engine/__tests__/catalog.test.ts`
Expected: FAIL — properties don't exist on Pokemon type

- [ ] **Step 3: Add evolution types to `engine/types.ts`**

Add after `Rarity` type:

```typescript
export type EvolutionStage = "basic" | "stage1" | "stage2";
```

Update `Pokemon` interface — add these fields:

```typescript
export interface Pokemon {
  readonly id: string;
  readonly templateId: string;
  readonly name: string;
  readonly types: readonly PokemonType[];
  readonly distance: number;
  readonly cost: number;
  readonly moves: readonly Move[];
  readonly rarity: Rarity;
  readonly description: string;
  readonly stage: EvolutionStage;
  readonly evolutionLine: string;       // templateId of the base form
  readonly evolvesInto: string | null;  // templateId of next stage
  readonly evolutionSpeed: number | null; // tiers to evolve (1=fast, 2=standard, 3=slow)
}
```

- [ ] **Step 4: Add new ability effect types to `engine/abilities/types.ts`**

Replace `AbilityEffect` with expanded version:

```typescript
export type AbilityEffect =
  | { type: "bonus_distance"; amount: number }
  | { type: "bonus_distance_per"; amount: number; per: "element_count"; element: PokemonType }
  | { type: "reduce_cost"; amount: number | "all"; target: "self" | "all" }
  | { type: "modify_threshold"; amount: number; duration: "route" | "permanent" }
  | { type: "bonus_currency"; amount: number }
  | { type: "peek_deck"; count: number }
  | { type: "reorder_deck"; count: number }        // Foresight: peek + reorder top N
  | { type: "bottom_deck"; count: number }          // Put N peeked cards on bottom
  | { type: "negate_bust" }
  | { type: "fury_draw" }                           // Draw an extra card immediately
  | { type: "echo"; echoEffect: AbilityEffect }     // Re-trigger echoEffect next round
  | { type: "armor"; amount: number; target: "next" | "duds" | "all" }  // Reduce cost of target cards
  | { type: "broadcast"; broadcastId: string; allAmount: number; ownerAmount: number; stat: "currency" | "threshold" | "distance" | "cost"; category: "beneficial" | "taxing" }
  | { type: "hex_currency"; amount: number }         // On bust: gain currency instead of penalty
  | { type: "hex_negate" };                           // On bust: negate bust
```

Add `"start_of_round"` to `AbilityTrigger`:

```typescript
export type AbilityTrigger = "on_draw" | "end_of_round" | "on_bust" | "start_of_round";
```

- [ ] **Step 5: Update `engine/types.ts` — add broadcast state and echo tracking to Trainer**

Add to `Trainer` interface:

```typescript
export interface Trainer {
  // ... existing fields ...
  readonly echoes: readonly EchoEntry[];           // Effects to trigger at start of next round
  readonly draftedAtTier: Record<string, number>;  // pokemonId -> tier when drafted
}

export interface EchoEntry {
  readonly pokemonId: string;
  readonly effect: AbilityEffect;
}
```

Add broadcast state to `GameState`:

```typescript
export interface GameState {
  // ... existing fields ...
  readonly activeBroadcasts: readonly ActiveBroadcast[];
}

export interface ActiveBroadcast {
  readonly ownerId: string;
  readonly pokemonName: string;
  readonly broadcastId: string;
  readonly allAmount: number;
  readonly ownerAmount: number;
  readonly stat: "currency" | "threshold" | "distance" | "cost";
  readonly category: "beneficial" | "taxing";
}
```

- [ ] **Step 6: Update `createPokemon` in `engine/pokemon/catalog.ts` to populate new fields**

Update `PokemonTemplate` interface and `createPokemon` function:

```typescript
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
```

- [ ] **Step 6b: Add new GameEvent types to `engine/types.ts`**

These are needed by later tasks (fury draw, evolution, echo, broadcast). Add them now to the `GameEvent` union:

```typescript
| { type: "fury_draw"; trainerId: string; pokemon: Pokemon }
| { type: "pokemon_evolved"; pokemonId: string; fromTemplateId: string; toTemplateId: string; fromName: string; toName: string }
| { type: "echo_triggered"; trainerId: string; pokemonId: string; effect: AbilityEffect }
| { type: "broadcast_resolved"; broadcasts: readonly ActiveBroadcast[]; modifiers: Record<string, BroadcastModifiers> }
| { type: "armor_applied"; trainerId: string; reduction: number; target: string }
```

Import `BroadcastModifiers` from `models/broadcast` (will be created in Task 4). For now, define a placeholder type or add the import later when the file exists.

- [ ] **Step 7: Run test to verify it still fails (pokemon.json not yet updated)**

Run: `npx vitest run engine/__tests__/catalog.test.ts`
Expected: FAIL — charmander template doesn't have the new fields yet (or doesn't exist)

- [ ] **Step 8: Commit types foundation**

```bash
git add engine/types.ts engine/abilities/types.ts engine/pokemon/catalog.ts engine/__tests__/catalog.test.ts
git commit -m "feat: add evolution and keyword types for card redesign"
```

---

### Task 2: Rewrite Pokemon Catalog (JSON)

**Files:**
- Rewrite: `engine/pokemon/pokemon.json`

- [ ] **Step 1: Write the new `pokemon.json` with starter deck cards and representative cards from each color group**

Start with the starter deck duds + starters, then add the example cards from the spec. Each entry needs the new fields: `stage`, `evolutionLine`, `evolvesInto`, `evolutionSpeed`.

```json
{
  "minor_dud": {
    "name": "Minor Dud",
    "types": [],
    "distance": 1,
    "cost": 2,
    "rarity": "common",
    "description": "A weak distraction.",
    "stage": "basic",
    "evolutionLine": "minor_dud",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": []
  },
  "major_dud": {
    "name": "Major Dud",
    "types": [],
    "distance": 1,
    "cost": 3,
    "rarity": "common",
    "description": "A dangerous obstacle.",
    "stage": "basic",
    "evolutionLine": "major_dud",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": []
  },
  "weak_dud": {
    "name": "Weak Dud",
    "types": [],
    "distance": 1,
    "cost": 1,
    "rarity": "common",
    "description": "Barely noticeable.",
    "stage": "basic",
    "evolutionLine": "weak_dud",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": []
  },
  "charmander": {
    "name": "Charmander",
    "types": ["fire"],
    "distance": 1,
    "cost": 2,
    "rarity": "common",
    "description": "Momentum: if 3+ cards drawn, +1 dist",
    "stage": "basic",
    "evolutionLine": "charmander",
    "evolvesInto": "charmeleon",
    "evolutionSpeed": 2,
    "moves": [
      {
        "name": "Momentum",
        "reminderText": "+1 distance if 3+ cards drawn",
        "trigger": "on_draw",
        "condition": { "type": "min_cards_played", "min": 3 },
        "effect": { "type": "bonus_distance", "amount": 1 }
      }
    ]
  },
  "charmeleon": {
    "name": "Charmeleon",
    "types": ["fire"],
    "distance": 3,
    "cost": 1,
    "rarity": "common",
    "description": "Fury: draw an extra card",
    "stage": "stage1",
    "evolutionLine": "charmander",
    "evolvesInto": "charizard",
    "evolutionSpeed": 2,
    "moves": [
      {
        "name": "Fury",
        "reminderText": "Draw an extra card immediately",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "fury_draw" }
      }
    ]
  },
  "charizard": {
    "name": "Charizard",
    "types": ["fire", "flying"],
    "distance": 4,
    "cost": 1,
    "rarity": "common",
    "description": "Momentum: +2 dist per Fire drawn. On bust: negate.",
    "stage": "stage2",
    "evolutionLine": "charmander",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": [
      {
        "name": "Momentum",
        "reminderText": "+2 distance per Fire drawn",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "bonus_distance_per", "amount": 2, "per": "element_count", "element": "fire" }
      },
      {
        "name": "Hex: Negate",
        "reminderText": "On bust, negate the bust",
        "trigger": "on_bust",
        "condition": null,
        "effect": { "type": "hex_negate" }
      }
    ]
  },
  "squirtle": {
    "name": "Squirtle",
    "types": ["water"],
    "distance": 1,
    "cost": 2,
    "rarity": "common",
    "description": "Foresight: peek top 1",
    "stage": "basic",
    "evolutionLine": "squirtle",
    "evolvesInto": "wartortle",
    "evolutionSpeed": 2,
    "moves": [
      {
        "name": "Foresight",
        "reminderText": "Peek at the top card",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "peek_deck", "count": 1 }
      }
    ]
  },
  "wartortle": {
    "name": "Wartortle",
    "types": ["water"],
    "distance": 2,
    "cost": 1,
    "rarity": "common",
    "description": "Foresight: peek top 2",
    "stage": "stage1",
    "evolutionLine": "squirtle",
    "evolvesInto": "blastoise",
    "evolutionSpeed": 2,
    "moves": [
      {
        "name": "Foresight",
        "reminderText": "Peek at the top 2 cards",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "reorder_deck", "count": 2 }
      }
    ]
  },
  "blastoise": {
    "name": "Blastoise",
    "types": ["water"],
    "distance": 3,
    "cost": 1,
    "rarity": "common",
    "description": "Foresight: peek 3, reorder. Shield: +2 threshold.",
    "stage": "stage2",
    "evolutionLine": "squirtle",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": [
      {
        "name": "Foresight",
        "reminderText": "Peek and reorder top 3 cards",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "reorder_deck", "count": 3 }
      },
      {
        "name": "Shield",
        "reminderText": "+2 bust threshold",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "modify_threshold", "amount": 2, "duration": "route" }
      }
    ]
  },
  "bulbasaur": {
    "name": "Bulbasaur",
    "types": ["grass", "poison"],
    "distance": 1,
    "cost": 2,
    "rarity": "common",
    "description": "Overgrowth: +1 dist if Grass ally drawn",
    "stage": "basic",
    "evolutionLine": "bulbasaur",
    "evolvesInto": "ivysaur",
    "evolutionSpeed": 2,
    "moves": [
      {
        "name": "Overgrowth",
        "reminderText": "+1 distance if another Grass was drawn",
        "trigger": "on_draw",
        "condition": { "type": "element_count", "element": "grass", "min": 2 },
        "effect": { "type": "bonus_distance", "amount": 1 }
      }
    ]
  },
  "ivysaur": {
    "name": "Ivysaur",
    "types": ["grass", "poison"],
    "distance": 2,
    "cost": 1,
    "rarity": "common",
    "description": "Overgrowth: +1 per Grass drawn",
    "stage": "stage1",
    "evolutionLine": "bulbasaur",
    "evolvesInto": "venusaur",
    "evolutionSpeed": 2,
    "moves": [
      {
        "name": "Overgrowth",
        "reminderText": "+1 distance per Grass drawn",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "bonus_distance_per", "amount": 1, "per": "element_count", "element": "grass" }
      }
    ]
  },
  "venusaur": {
    "name": "Venusaur",
    "types": ["grass", "poison"],
    "distance": 3,
    "cost": 1,
    "rarity": "common",
    "description": "Overgrowth: +2 per Grass drawn. Ramp: -1 cost all.",
    "stage": "stage2",
    "evolutionLine": "bulbasaur",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": [
      {
        "name": "Overgrowth",
        "reminderText": "+2 distance per Grass drawn",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "bonus_distance_per", "amount": 2, "per": "element_count", "element": "grass" }
      },
      {
        "name": "Ramp",
        "reminderText": "-1 cost to all cards this round",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "reduce_cost", "amount": 1, "target": "all" }
      }
    ]
  },
  "machop": {
    "name": "Machop",
    "types": ["fighting"],
    "distance": 2,
    "cost": 1,
    "rarity": "common",
    "description": "Momentum: if 4+ cards drawn, +2 dist",
    "stage": "basic",
    "evolutionLine": "machop",
    "evolvesInto": "machoke",
    "evolutionSpeed": 2,
    "moves": [
      {
        "name": "Momentum",
        "reminderText": "+2 distance if 4+ cards drawn",
        "trigger": "on_draw",
        "condition": { "type": "min_cards_played", "min": 4 },
        "effect": { "type": "bonus_distance", "amount": 2 }
      }
    ]
  },
  "machoke": {
    "name": "Machoke",
    "types": ["fighting"],
    "distance": 3,
    "cost": 1,
    "rarity": "common",
    "description": "Momentum: if 3+ cards drawn, +2 dist. Fury: draw extra if 5+ cards.",
    "stage": "stage1",
    "evolutionLine": "machop",
    "evolvesInto": "machamp",
    "evolutionSpeed": 2,
    "moves": [
      {
        "name": "Momentum",
        "reminderText": "+2 distance if 3+ cards drawn",
        "trigger": "on_draw",
        "condition": { "type": "min_cards_played", "min": 3 },
        "effect": { "type": "bonus_distance", "amount": 2 }
      }
    ]
  },
  "machamp": {
    "name": "Machamp",
    "types": ["fighting"],
    "distance": 4,
    "cost": 1,
    "rarity": "common",
    "description": "Momentum: +1 dist per Fighting drawn. Fury: draw extra.",
    "stage": "stage2",
    "evolutionLine": "machop",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": [
      {
        "name": "Momentum",
        "reminderText": "+1 distance per Fighting drawn",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "bonus_distance_per", "amount": 1, "per": "element_count", "element": "fighting" }
      },
      {
        "name": "Fury",
        "reminderText": "Draw an extra card",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "fury_draw" }
      }
    ]
  },
  "abra": {
    "name": "Abra",
    "types": ["psychic"],
    "distance": 1,
    "cost": 1,
    "rarity": "common",
    "description": "Foresight: peek top 2, reorder",
    "stage": "basic",
    "evolutionLine": "abra",
    "evolvesInto": "kadabra",
    "evolutionSpeed": 3,
    "moves": [
      {
        "name": "Foresight",
        "reminderText": "Peek and reorder top 2 cards",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "reorder_deck", "count": 2 }
      }
    ]
  },
  "kadabra": {
    "name": "Kadabra",
    "types": ["psychic"],
    "distance": 2,
    "cost": 1,
    "rarity": "common",
    "description": "Foresight: peek 3, reorder",
    "stage": "stage1",
    "evolutionLine": "abra",
    "evolvesInto": "alakazam",
    "evolutionSpeed": 3,
    "moves": [
      {
        "name": "Foresight",
        "reminderText": "Peek and reorder top 3 cards",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "reorder_deck", "count": 3 }
      }
    ]
  },
  "caterpie": {
    "name": "Caterpie",
    "types": ["bug"],
    "distance": 1,
    "cost": 1,
    "rarity": "common",
    "description": "Ramp: -1 cost to next card drawn",
    "stage": "basic",
    "evolutionLine": "caterpie",
    "evolvesInto": "metapod",
    "evolutionSpeed": 1,
    "moves": [
      {
        "name": "Ramp",
        "reminderText": "-1 cost to next card drawn",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "armor", "amount": 1, "target": "next" }
      }
    ]
  },
  "metapod": {
    "name": "Metapod",
    "types": ["bug"],
    "distance": 2,
    "cost": 1,
    "rarity": "common",
    "description": "Shield: +1 threshold. Ramp: -1 cost to next card.",
    "stage": "stage1",
    "evolutionLine": "caterpie",
    "evolvesInto": "butterfree",
    "evolutionSpeed": 1,
    "moves": [
      {
        "name": "Shield",
        "reminderText": "+1 bust threshold",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "modify_threshold", "amount": 1, "duration": "route" }
      },
      {
        "name": "Ramp",
        "reminderText": "-1 cost to next card drawn",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "armor", "amount": 1, "target": "next" }
      }
    ]
  },
  "butterfree": {
    "name": "Butterfree",
    "types": ["bug", "flying"],
    "distance": 3,
    "cost": 1,
    "rarity": "common",
    "description": "Shield: +2 threshold. Ramp: -1 cost all.",
    "stage": "stage2",
    "evolutionLine": "caterpie",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": [
      {
        "name": "Shield",
        "reminderText": "+2 bust threshold",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "modify_threshold", "amount": 2, "duration": "route" }
      },
      {
        "name": "Ramp",
        "reminderText": "-1 cost to all cards this round",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "reduce_cost", "amount": 1, "target": "all" }
      }
    ]
  },
  "geodude": {
    "name": "Geodude",
    "types": ["rock", "ground"],
    "distance": 2,
    "cost": 1,
    "rarity": "common",
    "description": "Shield: +1 threshold",
    "stage": "basic",
    "evolutionLine": "geodude",
    "evolvesInto": "graveler",
    "evolutionSpeed": 2,
    "moves": [
      {
        "name": "Shield",
        "reminderText": "+1 bust threshold",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "modify_threshold", "amount": 1, "duration": "route" }
      }
    ]
  },
  "graveler": {
    "name": "Graveler",
    "types": ["rock", "ground"],
    "distance": 3,
    "cost": 1,
    "rarity": "common",
    "description": "Shield: +2 threshold. Armor: next card -1 cost.",
    "stage": "stage1",
    "evolutionLine": "geodude",
    "evolvesInto": "golem",
    "evolutionSpeed": 2,
    "moves": [
      {
        "name": "Shield",
        "reminderText": "+2 bust threshold",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "modify_threshold", "amount": 2, "duration": "route" }
      },
      {
        "name": "Armor",
        "reminderText": "-1 cost to next card drawn",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "armor", "amount": 1, "target": "next" }
      }
    ]
  },
  "golem": {
    "name": "Golem",
    "types": ["rock", "ground"],
    "distance": 3,
    "cost": 1,
    "rarity": "common",
    "description": "Shield: +3 threshold. Armor: all duds -1 cost.",
    "stage": "stage2",
    "evolutionLine": "geodude",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": [
      {
        "name": "Shield",
        "reminderText": "+3 bust threshold",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "modify_threshold", "amount": 3, "duration": "route" }
      },
      {
        "name": "Armor",
        "reminderText": "-1 cost to all duds this round",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "armor", "amount": 1, "target": "duds" }
      }
    ]
  },
  "aron": {
    "name": "Aron",
    "types": ["steel"],
    "distance": 1,
    "cost": 1,
    "rarity": "common",
    "description": "Shield: +1 threshold. Armor: next card -1 cost.",
    "stage": "basic",
    "evolutionLine": "aron",
    "evolvesInto": "lairon",
    "evolutionSpeed": 2,
    "moves": [
      {
        "name": "Shield",
        "reminderText": "+1 bust threshold",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "modify_threshold", "amount": 1, "duration": "route" }
      },
      {
        "name": "Armor",
        "reminderText": "-1 cost to next card drawn",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "armor", "amount": 1, "target": "next" }
      }
    ]
  },
  "lairon": {
    "name": "Lairon",
    "types": ["steel", "rock"],
    "distance": 2,
    "cost": 1,
    "rarity": "common",
    "description": "Shield: +2 threshold. Armor: next card -2 cost.",
    "stage": "stage1",
    "evolutionLine": "aron",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": [
      {
        "name": "Shield",
        "reminderText": "+2 bust threshold",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "modify_threshold", "amount": 2, "duration": "route" }
      },
      {
        "name": "Armor",
        "reminderText": "-2 cost to next card drawn",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "armor", "amount": 2, "target": "next" }
      }
    ]
  },
  "pikachu": {
    "name": "Pikachu",
    "types": ["electric"],
    "distance": 2,
    "cost": 1,
    "rarity": "common",
    "description": "Broadcast: all +1 dist next round, you +2",
    "stage": "basic",
    "evolutionLine": "pikachu",
    "evolvesInto": "raichu",
    "evolutionSpeed": 1,
    "moves": [
      {
        "name": "Broadcast",
        "reminderText": "All players +1 dist next round, you +2",
        "trigger": "end_of_round",
        "condition": null,
        "effect": { "type": "broadcast", "broadcastId": "pikachu_dist", "allAmount": 1, "ownerAmount": 2, "stat": "distance", "category": "beneficial" }
      }
    ]
  },
  "raichu": {
    "name": "Raichu",
    "types": ["electric"],
    "distance": 3,
    "cost": 1,
    "rarity": "common",
    "description": "Broadcast: all +2 dist next round, you +4",
    "stage": "stage1",
    "evolutionLine": "pikachu",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": [
      {
        "name": "Broadcast",
        "reminderText": "All players +2 dist next round, you +4",
        "trigger": "end_of_round",
        "condition": null,
        "effect": { "type": "broadcast", "broadcastId": "raichu_dist", "allAmount": 2, "ownerAmount": 4, "stat": "distance", "category": "beneficial" }
      }
    ]
  },
  "poochyena": {
    "name": "Poochyena",
    "types": ["dark"],
    "distance": 2,
    "cost": 1,
    "rarity": "common",
    "description": "Broadcast: all +1 currency, you +2",
    "stage": "basic",
    "evolutionLine": "poochyena",
    "evolvesInto": "mightyena",
    "evolutionSpeed": 2,
    "moves": [
      {
        "name": "Broadcast",
        "reminderText": "All players +1 currency, you +2",
        "trigger": "end_of_round",
        "condition": null,
        "effect": { "type": "broadcast", "broadcastId": "poochyena_currency", "allAmount": 1, "ownerAmount": 2, "stat": "currency", "category": "beneficial" }
      }
    ]
  },
  "mightyena": {
    "name": "Mightyena",
    "types": ["dark"],
    "distance": 3,
    "cost": 1,
    "rarity": "common",
    "description": "Broadcast: all +2 currency, you +4",
    "stage": "stage1",
    "evolutionLine": "poochyena",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": [
      {
        "name": "Broadcast",
        "reminderText": "All players +2 currency, you +4",
        "trigger": "end_of_round",
        "condition": null,
        "effect": { "type": "broadcast", "broadcastId": "mightyena_currency", "allAmount": 2, "ownerAmount": 4, "stat": "currency", "category": "beneficial" }
      }
    ]
  },
  "sneasel": {
    "name": "Sneasel",
    "types": ["ice", "dark"],
    "distance": 3,
    "cost": 1,
    "rarity": "uncommon",
    "description": "Hex: on bust, negate (once per game)",
    "stage": "basic",
    "evolutionLine": "sneasel",
    "evolvesInto": "weavile",
    "evolutionSpeed": 2,
    "moves": [
      {
        "name": "Hex: Negate",
        "reminderText": "On bust, negate the bust",
        "trigger": "on_bust",
        "condition": null,
        "effect": { "type": "hex_negate" }
      }
    ]
  },
  "weavile": {
    "name": "Weavile",
    "types": ["ice", "dark"],
    "distance": 4,
    "cost": 1,
    "rarity": "uncommon",
    "description": "Hex: on bust, negate. Momentum: +2 dist if 4+ cards.",
    "stage": "stage1",
    "evolutionLine": "sneasel",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": [
      {
        "name": "Hex: Negate",
        "reminderText": "On bust, negate the bust",
        "trigger": "on_bust",
        "condition": null,
        "effect": { "type": "hex_negate" }
      },
      {
        "name": "Momentum",
        "reminderText": "+2 distance if 4+ cards drawn",
        "trigger": "on_draw",
        "condition": { "type": "min_cards_played", "min": 4 },
        "effect": { "type": "bonus_distance", "amount": 2 }
      }
    ]
  },
  "skarmory": {
    "name": "Skarmory",
    "types": ["steel", "flying"],
    "distance": 2,
    "cost": 1,
    "rarity": "uncommon",
    "description": "Shield: +2 threshold",
    "stage": "basic",
    "evolutionLine": "skarmory",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": [
      {
        "name": "Shield",
        "reminderText": "+2 bust threshold",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "modify_threshold", "amount": 2, "duration": "route" }
      }
    ]
  },
  "snorlax": {
    "name": "Snorlax",
    "types": ["normal"],
    "distance": 2,
    "cost": 1,
    "rarity": "rare",
    "description": "Shield: +3 threshold. If drawn first, +2 dist.",
    "stage": "basic",
    "evolutionLine": "snorlax",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": [
      {
        "name": "Shield",
        "reminderText": "+3 bust threshold",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "modify_threshold", "amount": 3, "duration": "route" }
      },
      {
        "name": "Body Slam",
        "reminderText": "+2 distance if drawn first",
        "trigger": "on_draw",
        "condition": { "type": "position", "position": "first" },
        "effect": { "type": "bonus_distance", "amount": 2 }
      }
    ]
  },
  "gengar": {
    "name": "Gengar",
    "types": ["ghost", "poison"],
    "distance": 2,
    "cost": 1,
    "rarity": "rare",
    "description": "Foresight: peek 2. Hex: on bust, +3 currency.",
    "stage": "basic",
    "evolutionLine": "gengar",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": [
      {
        "name": "Foresight",
        "reminderText": "Peek at top 2 cards",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "peek_deck", "count": 2 }
      },
      {
        "name": "Hex: Currency",
        "reminderText": "On bust, gain 3 currency instead of penalty",
        "trigger": "on_bust",
        "condition": null,
        "effect": { "type": "hex_currency", "amount": 3 }
      }
    ]
  },
  "dragonite": {
    "name": "Dragonite",
    "types": ["dragon", "flying"],
    "distance": 3,
    "cost": 2,
    "rarity": "rare",
    "description": "Momentum: +1 dist per Dragon drawn. Fury if 4+ cards.",
    "stage": "basic",
    "evolutionLine": "dragonite",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": [
      {
        "name": "Momentum",
        "reminderText": "+1 distance per Dragon drawn",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "bonus_distance_per", "amount": 1, "per": "element_count", "element": "dragon" }
      },
      {
        "name": "Fury",
        "reminderText": "Draw an extra card if 4+ cards drawn",
        "trigger": "on_draw",
        "condition": { "type": "min_cards_played", "min": 4 },
        "effect": { "type": "fury_draw" }
      }
    ]
  },
  "flygon": {
    "name": "Flygon",
    "types": ["ground", "dragon"],
    "distance": 3,
    "cost": 2,
    "rarity": "rare",
    "description": "Overgrowth: +1 per Ground drawn. Momentum: +2 if 4+ cards.",
    "stage": "basic",
    "evolutionLine": "flygon",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": [
      {
        "name": "Overgrowth",
        "reminderText": "+1 distance per Ground drawn",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "bonus_distance_per", "amount": 1, "per": "element_count", "element": "ground" }
      },
      {
        "name": "Momentum",
        "reminderText": "+2 distance if 4+ cards drawn",
        "trigger": "on_draw",
        "condition": { "type": "min_cards_played", "min": 4 },
        "effect": { "type": "bonus_distance", "amount": 2 }
      }
    ]
  },
  "alakazam": {
    "name": "Alakazam",
    "types": ["psychic"],
    "distance": 2,
    "cost": 2,
    "rarity": "rare",
    "description": "Foresight: peek 3, reorder. Echo: peek 2 next round.",
    "stage": "stage2",
    "evolutionLine": "abra",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": [
      {
        "name": "Foresight",
        "reminderText": "Peek and reorder top 3 cards",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "reorder_deck", "count": 3 }
      },
      {
        "name": "Echo",
        "reminderText": "Peek 2 cards at start of next round",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "echo", "echoEffect": { "type": "peek_deck", "count": 2 } }
      }
    ]
  },
  "aggron": {
    "name": "Aggron",
    "types": ["steel", "rock"],
    "distance": 2,
    "cost": 2,
    "rarity": "legendary",
    "description": "Shield: +4 threshold. Armor: all duds -1 cost.",
    "stage": "basic",
    "evolutionLine": "aggron",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": [
      {
        "name": "Shield",
        "reminderText": "+4 bust threshold",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "modify_threshold", "amount": 4, "duration": "route" }
      },
      {
        "name": "Armor",
        "reminderText": "-1 cost to all duds this round",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "armor", "amount": 1, "target": "duds" }
      }
    ]
  },
  "mewtwo": {
    "name": "Mewtwo",
    "types": ["psychic"],
    "distance": 3,
    "cost": 2,
    "rarity": "legendary",
    "description": "Foresight: peek 3, put 1 on bottom. Echo. Shield: +2.",
    "stage": "basic",
    "evolutionLine": "mewtwo",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": [
      {
        "name": "Foresight",
        "reminderText": "Peek 3 cards, put 1 on bottom",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "bottom_deck", "count": 1 }
      },
      {
        "name": "Echo",
        "reminderText": "Peek 2 at start of next round",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "echo", "echoEffect": { "type": "peek_deck", "count": 2 } }
      },
      {
        "name": "Shield",
        "reminderText": "+2 bust threshold",
        "trigger": "on_draw",
        "condition": null,
        "effect": { "type": "modify_threshold", "amount": 2, "duration": "route" }
      }
    ]
  },
  "darkrai": {
    "name": "Darkrai",
    "types": ["dark"],
    "distance": 3,
    "cost": 2,
    "rarity": "legendary",
    "description": "Broadcast: opponents +1 cost to first card. Hex: negate bust.",
    "stage": "basic",
    "evolutionLine": "darkrai",
    "evolvesInto": null,
    "evolutionSpeed": null,
    "moves": [
      {
        "name": "Broadcast",
        "reminderText": "All opponents +1 cost to first card next round",
        "trigger": "end_of_round",
        "condition": null,
        "effect": { "type": "broadcast", "broadcastId": "darkrai_cost", "allAmount": 1, "ownerAmount": 0, "stat": "cost", "category": "taxing" }
      },
      {
        "name": "Hex: Negate",
        "reminderText": "On bust, negate and keep distance",
        "trigger": "on_bust",
        "condition": null,
        "effect": { "type": "hex_negate" }
      }
    ]
  }
}
```

- [ ] **Step 2: Update `createStarterTeam` in `engine/pokemon/catalog.ts`**

```typescript
export function createStarterTeam(): Pokemon[] {
  return [
    ...Array.from({ length: 4 }, () => createPokemon("minor_dud")),
    ...Array.from({ length: 2 }, () => createPokemon("major_dud")),
    createPokemon("weak_dud"),
    createPokemon("charmander"),
    createPokemon("squirtle"),
    createPokemon("bulbasaur"),
  ];
}
```

- [ ] **Step 3: Run catalog tests to verify they pass**

Run: `npx vitest run engine/__tests__/catalog.test.ts`
Expected: PASS — charmander has evolution fields, snorlax has no evolution

- [ ] **Step 4: Commit new catalog**

```bash
git add engine/pokemon/pokemon.json engine/pokemon/catalog.ts engine/__tests__/catalog.test.ts
git commit -m "feat: rewrite pokemon catalog with new cost scale, keywords, and evolution lines"
```

---

## Chunk 2: Evolution System

### Task 3: Evolution Logic

**Files:**
- Create: `engine/pokemon/evolution.ts`
- Create: `engine/__tests__/evolution.test.ts`

- [ ] **Step 1: Write failing tests for evolution**

Create `engine/__tests__/evolution.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { evolveDeck } from "../pokemon/evolution";
import { createPokemon, resetPokemonIdCounter } from "../pokemon/catalog";
import { createDeck } from "../models/deck";

beforeEach(() => resetPokemonIdCounter());

describe("evolveDeck", () => {
  it("evolves a basic pokemon after enough tiers", () => {
    const charmander = createPokemon("charmander");
    const deck = createDeck([charmander]);
    const draftedAtTier: Record<string, number> = { [charmander.id]: 1 };

    const [newDeck, newDraftedAtTier, events] = evolveDeck(deck, draftedAtTier, 3);

    const evolved = newDeck.drawPile[0];
    expect(evolved.templateId).toBe("charmeleon");
    expect(evolved.id).toBe(charmander.id); // same id, transformed
    expect(events).toHaveLength(1);
    expect(events[0].fromTemplateId).toBe("charmander");
    expect(events[0].toTemplateId).toBe("charmeleon");
  });

  it("does not evolve if not enough tiers passed", () => {
    const charmander = createPokemon("charmander");
    const deck = createDeck([charmander]);
    const draftedAtTier: Record<string, number> = { [charmander.id]: 1 };

    const [newDeck, _, events] = evolveDeck(deck, draftedAtTier, 2);

    expect(newDeck.drawPile[0].templateId).toBe("charmander");
    expect(events).toHaveLength(0);
  });

  it("does not evolve single-stage pokemon", () => {
    const snorlax = createPokemon("snorlax");
    const deck = createDeck([snorlax]);
    const draftedAtTier: Record<string, number> = { [snorlax.id]: 1 };

    const [newDeck, _, events] = evolveDeck(deck, draftedAtTier, 10);

    expect(newDeck.drawPile[0].templateId).toBe("snorlax");
    expect(events).toHaveLength(0);
  });

  it("evolves pokemon in discard pile", () => {
    const charmander = createPokemon("charmander");
    const deck = { drawPile: [], drawn: [], discard: [charmander] };
    const draftedAtTier: Record<string, number> = { [charmander.id]: 1 };

    const [newDeck] = evolveDeck(deck, draftedAtTier, 3);

    expect(newDeck.discard[0].templateId).toBe("charmeleon");
  });

  it("does not evolve duds", () => {
    const dud = createPokemon("minor_dud");
    const deck = createDeck([dud]);
    const draftedAtTier: Record<string, number> = { [dud.id]: 1 };

    const [newDeck, _, events] = evolveDeck(deck, draftedAtTier, 10);

    expect(newDeck.drawPile[0].templateId).toBe("minor_dud");
    expect(events).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run engine/__tests__/evolution.test.ts`
Expected: FAIL — `evolveDeck` doesn't exist

- [ ] **Step 3: Implement `engine/pokemon/evolution.ts`**

```typescript
import type { Deck, Pokemon } from "../types";
import { getTemplate, createPokemon } from "./catalog";

export interface EvolutionEvent {
  readonly pokemonId: string;
  readonly fromTemplateId: string;
  readonly toTemplateId: string;
  readonly fromName: string;
  readonly toName: string;
}

export function evolveDeck(
  deck: Deck,
  draftedAtTier: Record<string, number>,
  currentTier: number,
): [Deck, Record<string, number>, EvolutionEvent[]] {
  const events: EvolutionEvent[] = [];
  const newDraftedAtTier = { ...draftedAtTier };

  function evolvePokemon(pokemon: Pokemon): Pokemon {
    if (!pokemon.evolvesInto || pokemon.evolutionSpeed === null) return pokemon;

    const draftTier = draftedAtTier[pokemon.id];
    if (draftTier === undefined) return pokemon;

    const tiersSinceDraft = currentTier - draftTier;
    if (tiersSinceDraft < pokemon.evolutionSpeed) return pokemon;

    const nextTemplate = getTemplate(pokemon.evolvesInto);
    const evolved: Pokemon = {
      id: pokemon.id, // keep same id
      templateId: pokemon.evolvesInto,
      name: nextTemplate.name,
      types: nextTemplate.types,
      distance: nextTemplate.distance,
      cost: nextTemplate.cost,
      moves: nextTemplate.moves,
      rarity: nextTemplate.rarity,
      description: nextTemplate.description,
      stage: nextTemplate.stage,
      evolutionLine: nextTemplate.evolutionLine,
      evolvesInto: nextTemplate.evolvesInto,
      evolutionSpeed: nextTemplate.evolutionSpeed,
    };

    // Reset draft tier for next evolution
    newDraftedAtTier[pokemon.id] = currentTier;

    events.push({
      pokemonId: pokemon.id,
      fromTemplateId: pokemon.templateId,
      toTemplateId: pokemon.evolvesInto,
      fromName: pokemon.name,
      toName: nextTemplate.name,
    });

    return evolved;
  }

  const newDeck: Deck = {
    drawPile: deck.drawPile.map(evolvePokemon),
    drawn: deck.drawn.map(evolvePokemon),
    discard: deck.discard.map(evolvePokemon),
  };

  return [newDeck, newDraftedAtTier, events];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run engine/__tests__/evolution.test.ts`
Expected: PASS

- [ ] **Step 5: Commit evolution system**

```bash
git add engine/pokemon/evolution.ts engine/__tests__/evolution.test.ts
git commit -m "feat: add evolution system for pokemon deck progression"
```

---

## Chunk 3: Broadcast System

### Task 4: Broadcast Collapse Resolution

**Files:**
- Create: `engine/models/broadcast.ts`
- Create: `engine/__tests__/broadcast.test.ts`

- [ ] **Step 1: Write failing tests for broadcast collapse**

Create `engine/__tests__/broadcast.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { collapseBroadcasts, applyBroadcasts } from "../models/broadcast";
import type { ActiveBroadcast } from "../types";

describe("collapseBroadcasts", () => {
  it("collapses same-stat broadcasts to strongest", () => {
    const broadcasts: ActiveBroadcast[] = [
      { ownerId: "p1", pokemonName: "Poochyena", broadcastId: "a", allAmount: 1, ownerAmount: 2, stat: "currency", category: "beneficial" },
      { ownerId: "p2", pokemonName: "Mightyena", broadcastId: "b", allAmount: 2, ownerAmount: 4, stat: "currency", category: "beneficial" },
    ];

    const collapsed = collapseBroadcasts(broadcasts);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].allAmount).toBe(2);
  });

  it("keeps broadcasts with different stats separate", () => {
    const broadcasts: ActiveBroadcast[] = [
      { ownerId: "p1", pokemonName: "Poochyena", broadcastId: "a", allAmount: 1, ownerAmount: 2, stat: "currency", category: "beneficial" },
      { ownerId: "p1", pokemonName: "Pikachu", broadcastId: "b", allAmount: 1, ownerAmount: 2, stat: "distance", category: "beneficial" },
    ];

    const collapsed = collapseBroadcasts(broadcasts);
    expect(collapsed).toHaveLength(2);
  });

  it("preserves all owner bonuses even when base collapses", () => {
    const broadcasts: ActiveBroadcast[] = [
      { ownerId: "p1", pokemonName: "Poochyena", broadcastId: "a", allAmount: 1, ownerAmount: 3, stat: "currency", category: "beneficial" },
      { ownerId: "p2", pokemonName: "Mightyena", broadcastId: "b", allAmount: 2, ownerAmount: 4, stat: "currency", category: "beneficial" },
    ];

    const result = applyBroadcasts(broadcasts, ["p1", "p2", "p3"]);
    expect(result["p1"].currency).toBe(3);  // personal bonus (total, not additive)
    expect(result["p2"].currency).toBe(4);  // personal bonus
    expect(result["p3"].currency).toBe(2);  // base (strongest allAmount)
  });

  it("returns empty modifiers when no broadcasts", () => {
    const result = applyBroadcasts([], ["p1"]);
    expect(result["p1"].currency).toBe(0);
    expect(result["p1"].threshold).toBe(0);
    expect(result["p1"].distance).toBe(0);
    expect(result["p1"].cost).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run engine/__tests__/broadcast.test.ts`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement `engine/models/broadcast.ts`**

```typescript
import type { ActiveBroadcast } from "../types";

export interface BroadcastModifiers {
  readonly currency: number;
  readonly threshold: number;
  readonly distance: number;
  readonly cost: number;
}

function emptyModifiers(): BroadcastModifiers {
  return { currency: 0, threshold: 0, distance: 0, cost: 0 };
}

/** Collapse broadcasts: per stat, keep only the strongest allAmount. */
export function collapseBroadcasts(broadcasts: readonly ActiveBroadcast[]): ActiveBroadcast[] {
  const byStat = new Map<string, ActiveBroadcast>();

  for (const b of broadcasts) {
    const existing = byStat.get(b.stat);
    if (!existing || b.allAmount > existing.allAmount) {
      byStat.set(b.stat, b);
    }
  }

  return [...byStat.values()];
}

/** Apply broadcast effects to all players. Owners get their personal bonus (total, not additive). */
export function applyBroadcasts(
  broadcasts: readonly ActiveBroadcast[],
  playerIds: readonly string[],
): Record<string, BroadcastModifiers> {
  const result: Record<string, BroadcastModifiers> = {};
  for (const id of playerIds) {
    result[id] = emptyModifiers();
  }

  // First collapse to get base amounts per stat
  const collapsed = collapseBroadcasts(broadcasts);

  // Apply base amounts to all players
  for (const b of collapsed) {
    for (const id of playerIds) {
      result[id] = { ...result[id], [b.stat]: result[id][b.stat as keyof BroadcastModifiers] + b.allAmount };
    }
  }

  // Override with owner personal bonuses (total, replaces base)
  // For taxing broadcasts: owner is exempt (gets 0 instead of the tax)
  // For beneficial broadcasts: owner gets their personal bonus (total, not additive)
  for (const b of broadcasts) {
    const current = result[b.ownerId];
    if (!current) continue;

    if (b.category === "taxing") {
      // Owner is exempt from their own tax
      result[b.ownerId] = { ...current, [b.stat]: b.ownerAmount };
    } else if (b.ownerAmount > 0) {
      const baseForStat = collapsed.find(c => c.stat === b.stat);
      const base = baseForStat ? baseForStat.allAmount : 0;
      const ownerTotal = Math.max(b.ownerAmount, base);
      result[b.ownerId] = { ...current, [b.stat]: ownerTotal };
    }
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run engine/__tests__/broadcast.test.ts`
Expected: PASS

- [ ] **Step 5: Commit broadcast system**

```bash
git add engine/models/broadcast.ts engine/__tests__/broadcast.test.ts
git commit -m "feat: add broadcast collapse and resolution system"
```

---

## Chunk 4: Ability Resolver Updates

### Task 5: Update Ability Resolver for New Effects

**Files:**
- Modify: `engine/abilities/resolver.ts`
- Create: `engine/__tests__/abilities.test.ts`

- [ ] **Step 1: Write failing tests for new ability effects**

Create `engine/__tests__/abilities.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { resolveMoves } from "../abilities/resolver";
import { createPokemon, resetPokemonIdCounter } from "../pokemon/catalog";
import type { RouteProgress } from "../types";

beforeEach(() => resetPokemonIdCounter());

const baseProgress: RouteProgress = {
  totalDistance: 0,
  totalCost: 0,
  pokemonDrawn: 1,
  activeEffects: [],
};

describe("Momentum keyword", () => {
  it("triggers when min_cards_played condition met", () => {
    const charmander = createPokemon("charmander");
    const progress = { ...baseProgress, pokemonDrawn: 3 };
    const effects = resolveMoves(charmander, "on_draw", [], progress, 8);
    expect(effects).toContainEqual({ type: "bonus_distance", amount: 1 });
  });

  it("does not trigger when cards drawn below threshold", () => {
    const charmander = createPokemon("charmander");
    const progress = { ...baseProgress, pokemonDrawn: 2 };
    const effects = resolveMoves(charmander, "on_draw", [], progress, 8);
    expect(effects.find(e => e.type === "bonus_distance")).toBeUndefined();
  });
});

describe("Fury keyword", () => {
  it("returns fury_draw effect", () => {
    const charmeleon = createPokemon("charmeleon");
    const effects = resolveMoves(charmeleon, "on_draw", [], baseProgress, 8);
    expect(effects).toContainEqual({ type: "fury_draw" });
  });
});

describe("Foresight keyword", () => {
  it("returns peek_deck effect", () => {
    const squirtle = createPokemon("squirtle");
    const effects = resolveMoves(squirtle, "on_draw", [], baseProgress, 8);
    expect(effects).toContainEqual({ type: "peek_deck", count: 1 });
  });

  it("returns reorder_deck for advanced foresight", () => {
    const abra = createPokemon("abra");
    const effects = resolveMoves(abra, "on_draw", [], baseProgress, 8);
    expect(effects).toContainEqual({ type: "reorder_deck", count: 2 });
  });
});

describe("Shield keyword", () => {
  it("returns modify_threshold effect", () => {
    const geodude = createPokemon("geodude");
    const effects = resolveMoves(geodude, "on_draw", [], baseProgress, 8);
    expect(effects).toContainEqual({ type: "modify_threshold", amount: 1, duration: "route" });
  });
});

describe("Overgrowth keyword", () => {
  it("scales with grass allies drawn", () => {
    const ivysaur = createPokemon("ivysaur");
    const grassAlly = createPokemon("bulbasaur");
    const effects = resolveMoves(ivysaur, "on_draw", [grassAlly, ivysaur], baseProgress, 8);
    // bonus_distance_per expands: 1 * 2 grass cards = 2
    expect(effects).toContainEqual({ type: "bonus_distance", amount: 2 });
  });
});

describe("Hex keyword", () => {
  it("hex_negate returns on_bust trigger", () => {
    const sneasel = createPokemon("sneasel");
    const effects = resolveMoves(sneasel, "on_bust", [], baseProgress, 8);
    expect(effects).toContainEqual({ type: "hex_negate" });
  });
});

describe("Broadcast keyword", () => {
  it("returns broadcast effect on end_of_round", () => {
    const poochyena = createPokemon("poochyena");
    const effects = resolveMoves(poochyena, "end_of_round", [poochyena], baseProgress, 8);
    expect(effects[0].type).toBe("broadcast");
  });
});

describe("Echo keyword", () => {
  it("returns echo effect wrapping inner effect", () => {
    const alakazam = createPokemon("alakazam");
    const effects = resolveMoves(alakazam, "on_draw", [], baseProgress, 8);
    const echo = effects.find(e => e.type === "echo");
    expect(echo).toBeDefined();
    if (echo && echo.type === "echo") {
      expect(echo.echoEffect).toEqual({ type: "peek_deck", count: 2 });
    }
  });
});

describe("Armor keyword", () => {
  it("returns armor effect", () => {
    const aron = createPokemon("aron");
    const effects = resolveMoves(aron, "on_draw", [], baseProgress, 8);
    const armor = effects.find(e => e.type === "armor");
    expect(armor).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run engine/__tests__/abilities.test.ts`
Expected: FAIL — resolver doesn't handle new effect types

- [ ] **Step 3: Update `engine/abilities/resolver.ts` to handle new effects**

The resolver's `resolveMoves` function already passes through unknown effect types (the `else` branch pushes them directly). The new effects (`fury_draw`, `echo`, `armor`, `broadcast`, `hex_negate`, `hex_currency`, `reorder_deck`, `bottom_deck`) are just new discriminated union variants — they pass through as-is. The only special case is `bonus_distance_per` expansion which already works.

Verify the resolver handles `hex_negate` like `negate_bust`. Update the resolver to alias `hex_negate` to `negate_bust` behavior in the action resolver (Task 6), not here. The resolver just passes effects through.

The existing resolver code should already work for all new effects since they pass through the `else` branch. Run the test to verify.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run engine/__tests__/abilities.test.ts`
Expected: PASS — resolver passes through new effect types

- [ ] **Step 5: Commit ability tests**

```bash
git add engine/__tests__/abilities.test.ts engine/abilities/resolver.ts
git commit -m "feat: verify ability resolver handles all new keyword effects"
```

---

## Chunk 5: Action Resolver Updates

### Task 6: Update handleHit for Fury, Armor, Echo, and hex_negate

**Files:**
- Modify: `engine/action-resolver.ts`
- Modify: `engine/__tests__/action-resolver.test.ts`

- [ ] **Step 1: Write failing tests for Fury draw mechanic**

Add to `engine/__tests__/action-resolver.test.ts`:

```typescript
describe("Fury draw mechanic", () => {
  it("draws an extra card when fury_draw effect triggers", () => {
    // Setup: trainer has charmeleon (Fury) + other cards in deck
    // Hit → should draw charmeleon AND automatically draw another card
    // Events should include 2 pokemon_drawn events
    const state = setupRouteWithDeck(["charmeleon", "geodude", "minor_dud"]);
    const trainerId = Object.keys(state.trainers)[0];

    const [newState, events] = resolveAction(state, { type: "hit", trainerId });

    const drawnEvents = events.filter(e => e.type === "pokemon_drawn");
    expect(drawnEvents).toHaveLength(2); // charmeleon + fury draw
    expect(drawnEvents[0].pokemon.templateId).toBe("charmeleon");
  });
});
```

Note: You'll need a `setupRouteWithDeck` helper that creates a game state in route phase with a specific deck order. Build this from the existing test helpers.

- [ ] **Step 2: Write failing tests for Armor mechanic**

```typescript
describe("Armor mechanic", () => {
  it("reduces next card cost by armor amount", () => {
    // Setup: trainer has aron (armor: next -1 cost) then minor_dud (cost 2)
    const state = setupRouteWithDeck(["aron", "minor_dud"]);
    const trainerId = Object.keys(state.trainers)[0];

    // Draw aron
    const [state2] = resolveAction(state, { type: "hit", trainerId });
    // Draw minor_dud — should have cost 1 instead of 2
    const [state3, events] = resolveAction(state2, { type: "hit", trainerId });

    const trainer = state3.trainers[trainerId];
    // aron cost 1 + minor_dud cost 1 (reduced from 2) = total cost 2
    expect(trainer.routeProgress.totalCost).toBe(2);
  });
});
```

- [ ] **Step 3: Write failing tests for hex_negate (replaces negate_bust)**

```typescript
describe("Hex negate mechanic", () => {
  it("negates bust when hex_negate card is in drawn pile", () => {
    // Setup: low threshold, sneasel in deck with high-cost cards
    // Draw enough to bust → sneasel's hex_negate should save
    const state = setupRouteWithLowThreshold(["sneasel", "major_dud", "major_dud", "major_dud"]);
    const trainerId = Object.keys(state.trainers)[0];

    // Draw until would bust
    let current = state;
    let lastEvents: GameEvent[] = [];
    for (let i = 0; i < 4; i++) {
      const [next, events] = resolveAction(current, { type: "hit", trainerId });
      current = next;
      lastEvents = events;
      if (current.trainers[trainerId].status !== "exploring") break;
    }

    // Sneasel should have negated the bust
    const negateEvent = lastEvents.find(e =>
      e.type === "ability_triggered" && e.effect.type === "hex_negate"
    );
    expect(negateEvent).toBeDefined();
    expect(current.trainers[trainerId].status).toBe("exploring");
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run engine/__tests__/action-resolver.test.ts`
Expected: FAIL

- [ ] **Step 5: Implement Fury draw loop in handleHit**

In `handleHit`, after resolving effects, check if any effect is `fury_draw`. If so, recursively draw another card. Add a `furyDepth` parameter to prevent infinite loops (max 5 fury draws per turn).

Update `handleHit` to call a new `performDraw` helper that can recurse on fury:

```typescript
function performDraw(
  state: GameState,
  trainerId: string,
  furyDepth: number = 0,
): ResolveResult {
  if (furyDepth > 5) return [state, []]; // safety limit

  const trainer = state.trainers[trainerId];
  const result = drawPokemon(trainer.deck);
  if (!result) return [state, []];
  const [newDeck, pokemon] = result;

  // ... existing effect resolution logic ...

  // Check for fury_draw effects
  const hasFury = effects.some(e => e.type === "fury_draw");

  // ... build updated state ...

  if (hasFury && updatedTrainer.status === "exploring") {
    // Recurse: draw another card
    const [furyState, furyEvents] = performDraw(
      { ...state, trainers: { ...state.trainers, [trainerId]: updatedTrainer } },
      trainerId,
      furyDepth + 1,
    );
    return [furyState, [...events, ...furyEvents]];
  }

  return [newState, events];
}
```

- [ ] **Step 6: Implement Armor cost reduction tracking**

Add `pendingArmorReduction` to `RouteProgress` or track it in `activeEffects`. When a card with `armor` effect (target: "next") is drawn, store the reduction amount. On the next draw, apply the reduction to that card's cost.

For `armor` target "duds": scan all drawn cards, reduce cost of each dud by the armor amount.

- [ ] **Step 7: Implement hex_negate as bust negation**

In the bust-checking section of `handleHit`, treat `hex_negate` the same as the existing `negate_bust`:

```typescript
if (busted) {
  for (const drawn of newDeck.drawn) {
    const bustEffects = resolveMoves(drawn, "on_bust", newDeck.drawn, progress, newThreshold);
    const negation = bustEffects.find(e => e.type === "negate_bust" || e.type === "hex_negate");
    if (negation) {
      busted = false;
      progress = { ...progress, totalCost: newThreshold };
      events.push({ ... });
      break;
    }
  }
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run engine/__tests__/action-resolver.test.ts`
Expected: PASS

- [ ] **Step 9: Commit action resolver updates**

```bash
git add engine/action-resolver.ts engine/__tests__/action-resolver.test.ts
git commit -m "feat: implement fury draw loop, armor cost reduction, and hex bust negation"
```

---

### Task 7: Update Route End for Broadcasts and Echo

**Files:**
- Modify: `engine/action-resolver.ts`

- [ ] **Step 1: Write failing test for broadcast collection on route end**

```typescript
describe("Broadcast collection on route end", () => {
  it("collects broadcast effects from drawn cards when stopping", () => {
    // Setup: trainer has poochyena (broadcast: +1 currency all, +2 you) drawn
    const state = setupRouteWithDeck(["poochyena"]);
    const trainerId = Object.keys(state.trainers)[0];

    const [state2] = resolveAction(state, { type: "hit", trainerId });
    const [state3, events] = resolveAction(state2, { type: "stop", trainerId });

    expect(state3.activeBroadcasts.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Write failing test for echo state collection**

```typescript
describe("Echo state collection", () => {
  it("stores echo effects on trainer when stopping", () => {
    // Setup: trainer has alakazam (echo: peek 2 next round) drawn
    const state = setupRouteWithDeck(["alakazam"]);
    const trainerId = Object.keys(state.trainers)[0];

    const [state2] = resolveAction(state, { type: "hit", trainerId });
    const [state3] = resolveAction(state2, { type: "stop", trainerId });

    expect(state3.trainers[trainerId].echoes).toHaveLength(1);
    expect(state3.trainers[trainerId].echoes[0].effect.type).toBe("peek_deck");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run engine/__tests__/action-resolver.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement broadcast and echo collection in resolveRouteEnd**

In `resolveRouteEnd`, scan drawn cards for broadcast and echo effects:

```typescript
function resolveRouteEnd(trainer: Trainer, trail: Trail, event: RouteEvent | null): {
  vpEarned: number;
  currencyEarned: number;
  events: GameEvent[];
  broadcasts: ActiveBroadcast[];
  echoes: EchoEntry[];
} {
  // ... existing VP/currency calculation ...

  const broadcasts: ActiveBroadcast[] = [];
  const echoes: EchoEntry[] = [];

  for (const drawn of trainer.deck.drawn) {
    const effects = resolveMoves(drawn, "end_of_round", trainer.deck.drawn, trainer.routeProgress, trainer.bustThreshold);
    for (const effect of effects) {
      if (effect.type === "broadcast") {
        broadcasts.push({
          ownerId: trainer.id,
          pokemonName: drawn.name,
          broadcastId: effect.broadcastId,
          allAmount: effect.allAmount,
          ownerAmount: effect.ownerAmount,
          stat: effect.stat,
          category: effect.category,
        });
      } else if (effect.type === "bonus_currency") {
        bonusCurrency += effect.amount;
      }
      // ... existing event push ...
    }
  }

  // Collect echoes from on_draw effects via the resolver (respects conditions)
  for (const drawn of trainer.deck.drawn) {
    const drawEffects = resolveMoves(drawn, "on_draw", trainer.deck.drawn, trainer.routeProgress, trainer.bustThreshold);
    for (const effect of drawEffects) {
      if (effect.type === "echo") {
        echoes.push({ pokemonId: drawn.id, effect: effect.echoEffect });
      }
    }
  }

  return { vpEarned, currencyEarned, events, broadcasts, echoes };
}
```

- [ ] **Step 5: Apply broadcasts in maybeEndRoute**

In `maybeEndRoute`, after all trainers are done, collect all broadcasts, apply them via `applyBroadcasts()`, and add the modifiers to each trainer's state. Store collapsed broadcasts on `GameState.activeBroadcasts`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run engine/__tests__/action-resolver.test.ts`
Expected: PASS

- [ ] **Step 7: Commit broadcast and echo integration**

```bash
git add engine/action-resolver.ts engine/__tests__/action-resolver.test.ts
git commit -m "feat: integrate broadcast collection and echo state tracking on route end"
```

---

### Task 7b: Echo Trigger on Route Start + Hex Once-Per-Game

**Files:**
- Modify: `engine/action-resolver.ts`
- Modify: `engine/types.ts`

- [ ] **Step 1: Write failing test for echo trigger on first draw of a route**

```typescript
describe("Echo trigger on route start", () => {
  it("fires stored echo effects on first draw of new route", () => {
    // Setup: trainer has echoes from previous route (peek 2)
    // On first hit of next route, the echo effect should fire
    // Then echoes should be cleared
  });
});
```

- [ ] **Step 2: Implement echo trigger in handleHit**

At the start of `handleHit`, check if the trainer has echoes and this is their first draw (`pokemonDrawn === 0`). If so, fire each echo effect and clear the echoes list.

```typescript
// In handleHit, before drawing:
let echoEvents: GameEvent[] = [];
let updatedEchoes = trainer.echoes;
if (trainer.routeProgress.pokemonDrawn === 0 && trainer.echoes.length > 0) {
  for (const echo of trainer.echoes) {
    echoEvents.push({
      type: "echo_triggered",
      trainerId: trainer.id,
      pokemonId: echo.pokemonId,
      effect: echo.effect,
    });
  }
  updatedEchoes = []; // clear after firing
}
```

- [ ] **Step 3: Add `usedHexNegate` to Trainer for once-per-game tracking**

Add to `Trainer` interface:
```typescript
readonly usedHexNegate: boolean;
```

In the bust-checking section, when `hex_negate` fires, set `usedHexNegate: true`. Only allow `hex_negate` to fire if `usedHexNegate` is false:

```typescript
if (busted && !trainer.usedHexNegate) {
  const negation = bustEffects.find(e => e.type === "hex_negate");
  if (negation) {
    busted = false;
    // ... set usedHexNegate: true on updated trainer
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add engine/action-resolver.ts engine/types.ts engine/__tests__/action-resolver.test.ts
git commit -m "feat: implement echo trigger on route start and hex_negate once-per-game tracking"
```

---

## Chunk 6: Hub & Pricing Updates

### Task 8: Update Hub Pricing and Evolution Trigger

**Files:**
- Modify: `engine/phases/hub.ts`
- Modify: `engine/pokemon/rarity.ts`

- [ ] **Step 1: Write failing test for new pricing matrix**

Add to test file:

```typescript
describe("hub pricing", () => {
  it("prices by rarity x stage", () => {
    expect(pokemonPrice(createPokemon("charmander"))).toBe(2);   // common basic
    expect(pokemonPrice(createPokemon("charmeleon"))).toBe(4);    // common stage1
    expect(pokemonPrice(createPokemon("charizard"))).toBe(7);     // common stage2
    expect(pokemonPrice(createPokemon("sneasel"))).toBe(3);       // uncommon basic
    expect(pokemonPrice(createPokemon("snorlax"))).toBe(5);       // rare basic
    expect(pokemonPrice(createPokemon("mewtwo"))).toBe(8);        // legendary basic
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run engine/__tests__/hub.test.ts`
Expected: FAIL — old pricing

- [ ] **Step 3: Rewrite `pokemonPrice` in `engine/phases/hub.ts`**

```typescript
function pokemonPrice(pokemon: Pokemon): number {
  const priceMatrix: Record<string, Record<string, number>> = {
    common:    { basic: 2, stage1: 4, stage2: 7 },
    uncommon:  { basic: 3, stage1: 5, stage2: 8 },
    rare:      { basic: 5, stage1: 7 },
    legendary: { basic: 8 },
  };
  const rarityPrices = priceMatrix[pokemon.rarity];
  if (!rarityPrices) throw new Error(`Unknown rarity: ${pokemon.rarity}`);
  const price = rarityPrices[pokemon.stage];
  if (price === undefined) throw new Error(`Invalid rarity/stage combination: ${pokemon.rarity}/${pokemon.stage}`);
  return price;
}
```

- [ ] **Step 4: Update busted player free picks (1 instead of 0)**

In `enterHub`, change busted trainer handling:

```typescript
if (bustedSet.has(id)) {
  // Busted players get 1 free pick instead of 0
  if (pool.length >= 1) {
    const idx = Math.floor(rng() * pool.length);
    freePickOffers[id] = [createPokemon(pool[idx])];
  } else {
    freePickOffers[id] = [];
  }
}
```

- [ ] **Step 5: Add evolution trigger in hub entry**

In `enterHub` (or in `maybeEndRoute` before calling `enterHub`), call `evolveDeck` for each trainer. This requires knowing the current tier from the map.

```typescript
// In maybeEndRoute, before entering hub:
const currentTier = state.map?.nodes[state.map.currentNodeId].tier ?? 0;
for (const [id, t] of Object.entries(trainers)) {
  const [evolvedDeck, newDraftedAtTier, evoEvents] = evolveDeck(t.deck, t.draftedAtTier, currentTier);
  trainers[id] = { ...t, deck: evolvedDeck, draftedAtTier: newDraftedAtTier };
  for (const evo of evoEvents) {
    events.push({ type: "pokemon_evolved", ...evo });
  }
}
```

- [ ] **Step 6: Add `draftedAtTier` tracking when selecting pokemon in hub**

In `handleConfirmSelections`, when adding pokemon to deck, record the current tier:

```typescript
const currentTier = state.map?.nodes[state.map.currentNodeId].tier ?? 0;
const newDraftedAtTier = { ...trainer.draftedAtTier };
for (const pokemon of selectedPokemon) {
  newDraftedAtTier[pokemon.id] = currentTier;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 8: Commit hub updates**

```bash
git add engine/phases/hub.ts engine/pokemon/rarity.ts engine/__tests__/hub.test.ts
git commit -m "feat: update hub pricing to rarity x stage, add evolution trigger, busted players get 1 pick"
```

---

## Chunk 7: Stage-Aware Pool Generation & Cleanup

### Task 9: Update Route Pool Generation for Stages

**Files:**
- Modify: `engine/map-generator.ts`
- Modify: `engine/pokemon/rarity.ts`

- [ ] **Step 1: Write failing test for tier-based pool composition**

```typescript
describe("route pool generation", () => {
  it("early tiers favor basics", () => {
    const pool = generatePoolForTier(1, 8);
    const stages = pool.map(id => getTemplate(id).stage);
    const basicCount = stages.filter(s => s === "basic").length;
    expect(basicCount / pool.length).toBeGreaterThan(0.7);
  });

  it("late tiers include stage2 and legendaries", () => {
    const pool = generatePoolForTier(7, 8);
    const templates = pool.map(id => getTemplate(id));
    const hasAdvanced = templates.some(t => t.stage === "stage2" || t.rarity === "legendary");
    expect(hasAdvanced).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run engine/__tests__/rarity.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement stage-aware pool generation**

Update `engine/pokemon/rarity.ts` to add stage filtering:

```typescript
export function buildStageBuckets(allIds: string[]): Record<string, string[]> {
  const buckets: Record<string, string[]> = {};
  for (const id of allIds) {
    const stage = getTemplate(id).stage ?? "basic";
    (buckets[stage] ??= []).push(id);
  }
  return buckets;
}

export function pickByTier(
  tier: number,
  totalTiers: number,
  allIds: string[],
  rng: RngFn,
): string {
  const progress = tier / (totalTiers - 1);
  const stageBuckets = buildStageBuckets(allIds);
  const rarityBuckets = buildRarityBuckets(allIds);

  // Stage weights by progress
  const stageWeights: Record<string, number> = {
    basic: Math.max(0.1, 1.0 - progress * 0.8),
    stage1: progress * 0.6,
    stage2: progress > 0.5 ? (progress - 0.5) * 0.8 : 0,
  };

  // Pick stage first, then pick from that stage with rarity weighting
  const totalStageWeight = Object.values(stageWeights).reduce((a, b) => a + b, 0);
  let roll = rng() * totalStageWeight;
  let targetStage = "basic";
  for (const [stage, weight] of Object.entries(stageWeights)) {
    roll -= weight;
    if (roll <= 0) { targetStage = stage; break; }
  }

  const candidates = stageBuckets[targetStage];
  if (!candidates?.length) return allIds[Math.floor(rng() * allIds.length)];

  // Filter out duds from pool
  const nonDuds = candidates.filter(id => !id.includes("dud"));
  if (!nonDuds.length) return allIds[Math.floor(rng() * allIds.length)];

  return nonDuds[Math.floor(rng() * nonDuds.length)];
}
```

- [ ] **Step 4: Update `map-generator.ts` to use `pickByTier` for pokemon pools**

Replace the current pokemon pool generation in `generateMap` to use `pickByTier`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit pool generation updates**

```bash
git add engine/pokemon/rarity.ts engine/map-generator.ts
git commit -m "feat: stage-aware route pool generation based on tier progression"
```

---

### Task 10: Fix Existing Tests and Final Integration

**Files:**
- Modify: `engine/__tests__/action-resolver.test.ts`
- Modify: `engine/index.ts`

- [ ] **Step 1: Update initial game state in `engine/index.ts`**

Add `activeBroadcasts: []` to the initial state, and `echoes: []`, `draftedAtTier: {}` to initial trainer creation.

- [ ] **Step 2: Run all existing tests**

Run: `npx vitest run`
Expected: Some failures from old tests referencing removed pokemon (rattata, pidgey, etc.)

- [ ] **Step 3: Fix broken tests**

Update tests that reference old pokemon names/template IDs to use new ones. Update test helpers (`setupRoute`, `hitUntilBust`, etc.) to work with the new starter deck composition.

- [ ] **Step 4: Run all tests to verify full pass**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Commit final integration**

```bash
git add -A
git commit -m "feat: complete card redesign integration — all tests passing"
```

---

### Note: Foresight Reorder Player Interaction

The spec says Foresight lets players "peek at top N cards" and "may reorder them." This requires a player interaction step (choosing the reorder). This should be implemented as a sub-state during the draw loop: when a `reorder_deck` effect triggers, the game pauses for that player to submit an ordering action (new action type `reorder_deck`). This is a UI-heavy feature — defer the interactive reorder to a follow-up task. For now, `reorder_deck` just reveals the top N cards (peek only) and `bottom_deck` auto-moves the bottom card. Full reorder interaction can be added later.

### Note: Rest Stop Mechanic

The spec mentions rest stops offer Scout and Reinforce. The existing code has a `"remove"` option. The spec says duds are permanent and should NOT be removed. Update the `rest_stop_choice` action to remove the `"remove"` option, keeping only `"scout"` and `"reinforce"`. This is a small change in `engine/phases/rest-stop.ts` — update the validation to reject `"remove"` choices.
