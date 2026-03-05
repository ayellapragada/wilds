# Wilds — Implementation Plan

Multiplayer roguelike push-your-luck party game. Jackbox-style: one shared TV screen, everyone plays on their phones.

You're all **trainers** exploring the wilds, trying to become champion. Each game is a run through a series of **routes**. On each route, you push your luck — drawing creatures from your deck one at a time, traveling as far as you can without going wild (busting). Between routes, the group enters the **world** phase: voting on the next route, hitting the marketplace, managing your team.

Target session: ~45 minutes. 4-20 trainers.

---

## Core Gameplay Loop

Two alternating phases:

### ROUTE Phase (push-your-luck core)
- **TV (central screen):** Side-scrolling view showing all trainers progressing along the route
- **Phone (player screen):** Two buttons — **HIT** (draw another creature) or **STOP** (lock in your distance)
- Each creature adds distance (good) and cost (risk). If total cost > bust threshold → you go wild.
- **STOP safely:** get BOTH score + currency
- **BUST:** choose ONE — keep score OR keep currency

### WORLD Phase (meta-game)
- **TV (central screen):** Overworld map showing available routes, marketplace, group decisions
- **Phone (player screen):** Vote on next route. Browse marketplace. Manage team/deck.

### Full Loop
```
Lobby → World (pick first route) → Route → World → Route → ... → Champion Route → Game Over
```

---

## Current State

### What's built and working:
- Project scaffolding (Vite, Svelte 5, Wrangler, Vitest, partyserver)
- Engine types, deck operations, starter deck, card catalog
- Push-your-luck core: draw/stop/bust/bust-penalty via action-resolver
- Round management (auto-advances when all done)
- Deck tests (draw, reshuffle, add, remove, bust detection, composition)
- PartyKit server (thin wrapper, state sync, action dispatch)
- Basic Svelte frontend (lobby + encounter UI)
- WebSocket client connection

### What needs to change before moving forward:
The codebase uses generic terms (Card, Player, Round, encounter). The spec uses game-themed vocabulary. This rename aligns code with the game's identity and the spec.

---

## Phase A: Rename & Restructure (align codebase with spec)

> Rename types, functions, files, and phases to match the game domain. No logic changes.

### Types (`engine/types.ts`)
- [ ] `Card` → `Creature`
- [ ] `Player` → `Trainer`
- [ ] `PlayerStatus` → `TrainerStatus` (`"waiting" | "exploring" | "busted" | "stopped"` — rename `"active"` → `"exploring"`)
- [ ] `TurnState` → `RouteProgress` (fields: `totalDistance`, `totalCost`, `creaturesDrawn`, `activeEffects`)
- [ ] `Round` → `Route` (fields: `routeNumber`, `name`, `turnOrder`, `currentTurnIndex`, `trainerResults`, `status`, `modifiers`)
- [ ] `RoundResult` → `RouteResult`
- [ ] `EncounterModifier` → `RouteModifier`
- [ ] `Shop` → `Marketplace` (fields: `availableCreatures`, `prices`, `trainerPurchases`)
- [ ] `MapNode` → `RouteNode` (type field: `"route" | "elite_route" | "marketplace" | "rest_stop" | "event" | "champion"`)
- [ ] `GameMap` → `WorldMap`
- [ ] `GamePhase` → simplify to `"lobby" | "route" | "world" | "game_over"`
- [ ] `GameState` → rename fields: `players` → `trainers`, `currentRound` → `currentRoute`, `shop` → `marketplace`, `map` → `map` (keep), `roundNumber` → `routeNumber`
- [ ] `GameSettings` → `maxPlayers` → `maxTrainers`, remove `turnMode` (open question, not a setting yet)

### Actions
- [ ] `"draw_card"` → `"hit"`, `playerId` → `trainerId`
- [ ] `"stop_turn"` → `"stop"`, `playerId` → `trainerId`
- [ ] `"join_game"` → keep, but `playerName` → `trainerName`
- [ ] `"start_game"` → keep, `playerId` → `trainerId`
- [ ] `"choose_bust_penalty"` → keep, `playerId` → `trainerId`
- [ ] `"cast_vote"` → keep, `playerId` → `trainerId`
- [ ] `"buy_card"` → `"buy_creature"`, `playerId` → `trainerId`, `cardId` → `creatureId`
- [ ] `"sell_card"` → `"sell_creature"`, same field renames
- [ ] `"choose_rest_benefit"` → keep, `playerId` → `trainerId`
- [ ] `"ready_up"` → keep, `playerId` → `trainerId`

### Events
- [ ] `"player_joined"` → `"trainer_joined"`, `playerName` → `trainerName`
- [ ] `"round_started"` → `"route_started"`, add `routeName`, `modifiers`
- [ ] `"card_drawn"` → `"creature_drawn"`, `card` → `creature`, `turnState` → `progress`
- [ ] `"player_busted"` → `"trainer_busted"`
- [ ] `"player_stopped"` → `"trainer_stopped"`
- [ ] `"bust_penalty_chosen"` → keep, rename `playerId` → `trainerId`
- [ ] `"round_ended"` → `"route_completed"`
- [ ] `"shop_opened"` → `"marketplace_opened"`, `availableCards` → `availableCreatures`
- [ ] `"card_purchased"` → `"creature_purchased"`
- [ ] `"card_sold"` → `"creature_sold"`
- [ ] `"game_over"` → `winnerId` → `championId`
- [ ] Add `"world_entered"` event

### Files
- [ ] `engine/cards/catalog.ts` → `engine/creatures/catalog.ts` (rename `createStarterDeck` → `createStarterTeam`, `CARD_CATALOG` → `CREATURE_CATALOG`)
- [ ] `engine/models/deck.ts` → rename exports: `drawCard` → `drawCreature`, `addCard` → `addCreature`, `removeCard` → `removeCreature`
- [ ] `engine/action-resolver.ts` → rename all internal functions and references
- [ ] `engine/index.ts` → update imports/exports
- [ ] `engine/__tests__/deck.test.ts` → update to use new names
- [ ] `party/server.ts` → update imports
- [ ] `src/App.svelte` → update to use new type names
- [ ] `src/lib/connection.ts` → update type imports

### Logic tweak (minimal)
- [ ] `maybeEndRound` → `maybeEndRoute`: transition to `"world"` phase instead of looping into another round

---

## Phase B: Action Resolver Tests

> The core loop works but has no dedicated tests. Write them before adding new features.

- [ ] `engine/__tests__/action-resolver.test.ts` — join, start, hit, stop, bust penalty, multi-trainer route, route completion, phase transition to world

---

## Phase C: Ability System

> Creatures with special effects that cascade like Balatro.

- [ ] `engine/abilities/ability.ts` — Ability interface
- [ ] `engine/abilities/implementations.ts` — Core abilities: stonewall, fire_amplifier, tidal_shield, earthquake, dodge, cleanse
- [ ] `engine/abilities/registry.ts` — resolveAbilities pipeline (own ability → reactions from drawn creatures → route modifiers)
- [ ] `engine/__tests__/abilities.test.ts` — Each ability in isolation, cascading resolution, route modifier interaction
- [ ] Wire ability resolution into `handleHit` in action-resolver

---

## Phase D: World Map & Voting

> Roguelike map generation and group voting on path.

- [ ] `engine/models/world-map.ts` — RouteNode helpers
- [ ] `engine/map-generator.ts` — generateMap (DAG with tiers, node types, connectivity)
- [ ] `engine/phases/world.ts` — handleVote, tally, tiebreak (random among tied), transition to next node's phase
- [ ] `engine/__tests__/map-generator.test.ts` — Valid DAG, all nodes reachable, type distribution
- [ ] `engine/__tests__/voting.test.ts` — Majority wins, tiebreak, all-voted detection
- [ ] Wire vote/world actions into action-resolver

---

## Phase E: Marketplace & Rest Stops

> Between-route phases for team building.

- [ ] `engine/models/marketplace.ts` — Marketplace state, creature generation, pricing
- [ ] `engine/phases/world.ts` — handleBuyCreature, handleSellCreature, currency validation
- [ ] Rest stop logic (threshold boost, creature removal, preview — details TBD)
- [ ] `engine/phases/game-over.ts` — Final scoring, champion determination
- [ ] `engine/__tests__/marketplace.test.ts` — Buy/sell, currency, stock depletion

---

## Phase F: Full Game State Machine

> Wire all phases into a complete game loop.

- [ ] Phase transitions: lobby → world → route → world → ... → champion route → game_over
- [ ] Wire all remaining actions into action-resolver (currently only handles lobby + route)
- [ ] `engine/__tests__/full-game.test.ts` — Programmatic bot plays entire run end-to-end

---

## Phase G: PartyKit Server (full)

> Upgrade the thin wrapper to handle the full game.

- [ ] `party/server.ts` — onStart, onConnect, onMessage, onClose (already partially done)
- [ ] State persistence to Durable Object storage for crash recovery
- [ ] Session token validation for reconnection
- [ ] State sync sends appropriate view per connection (TV vs phone)

---

## Phase H: Svelte Frontend

> TV display and phone controller UIs.

- [ ] `src/lib/stores.ts` — Svelte stores for game state
- [ ] `src/lib/router.ts` — Hash-based routing (#/play/XXXX, #/table/XXXX)
- [ ] **Phone screens:** JoinScreen, HitOrStop, BustChoice, WorldControls (vote + marketplace + team), DeckView
- [ ] **TV screens:** Lobby, RouteView (side-scrolling progress), WorldView (overworld map), Scoreboard
- [ ] **Shared:** CreatureCard, TrainerIcon, QRCode

---

## Phase I: Polish & Deploy

- [ ] Reconnection handling (session tokens, state recovery)
- [ ] Animation/event queue on frontend
- [ ] Remaining abilities (rebirth, gamble, phoenix, legendary creatures)
- [ ] Balancing and playtesting
- [ ] GitHub Pages deployment for frontend
- [ ] Production deploy to Cloudflare

---

## Current Goal

**Phase A** — Rename everything to match the game domain, then **Phase B** — write action-resolver tests. After that, the codebase is clean and tested, ready for abilities and world phase.

---

## Open Design Questions

- **Marketplace specifics:** Shared stock (competitive) vs individual offers? Trading between trainers?
- **Route modifiers:** Weather? Terrain types? What makes routes feel different?
- **Rest stops:** Heal threshold? Remove a creature? Preview draws?
- **Events (random):** Group effects — "a storm reduces everyone's threshold by 2 next route"
- **Turn order:** Random each route? Lowest score first (catchup)?
- **Timer on HIT/STOP:** Keep pacing tight with large groups?
- **Simultaneous mode:** Everyone draws at once instead of taking turns — better for 10+ trainers?
- **Tiebreak rules:** Random among tied options? Something else?
