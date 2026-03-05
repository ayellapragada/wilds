# Wilds — Implementation Plan

Multiplayer roguelike push-your-luck card game. Think "multiplayer Balatro meets Quacks of Quedlinburg with a Slay the Spire map, played Jackbox-style."

Players connect via phones to a shared game displayed on a TV. Each player builds a personal deck of creatures over the course of a roguelike run. At encounter nodes, everyone simultaneously does push-your-luck rounds — drawing one creature at a time, accumulating distance, risking a bust. Between encounters, the group votes on which map path to take. Individual scoring, one winner at the end. Target session: ~45 minutes.

---

## Phase 1: Project Scaffolding
> Get a deployable skeleton with dev tooling working.

- [ ] Initialize package.json with all deps (`partyserver`, `svelte`, `vite`, `vitest`, `wrangler`, `concurrently`, etc.)
- [ ] Config files: `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `svelte.config.js`, `wrangler.jsonc`, `vitest.config.ts`
- [ ] Minimal `party/server.ts` — echo server (accepts connection, echoes messages)
- [ ] Minimal `src/main.ts` + `App.svelte` — "Hello Wilds" page
- [ ] `index.html` with viewport meta for mobile
- [ ] Verify: `npm run dev:all` starts both servers, `npm run test:run` passes (no tests yet is fine), `npm run deploy` deploys to Cloudflare

## Phase 2: Core Engine Types & Deck
> Pure engine with deck operations, fully tested.

- [ ] `engine/types.ts` — All type definitions (Card, Deck, Player, TurnState, GameState, GamePhase, etc.)
- [ ] `engine/actions.ts` — Action discriminated union
- [ ] `engine/events.ts` — Event discriminated union
- [ ] `engine/models/deck.ts` — createDeck, drawCard, endTurn, addCard, removeCard, deckSize, shuffle
- [ ] `engine/cards/catalog.ts` — Starter deck (9 cards), full card catalog
- [ ] `engine/__tests__/deck.test.ts` — Draw, reshuffle, add, remove, deckSize tests
- [ ] `engine/index.ts` — Public API barrel export

## Phase 3: Push-Your-Luck Core Loop
> Single player turn: draw → accumulate → bust/stop. The heart of the game.

- [ ] `engine/models/player.ts` — Player creation, fresh turn state
- [ ] `engine/phases/encounter.ts` — handleDraw, handleStop, handleBustPenalty, advanceTurn
- [ ] `engine/__tests__/round.test.ts` — Draw accumulates distance/cost, bust when cost > threshold, stop earns score + currency, bust penalty choice (keep_score vs keep_currency)

## Phase 4: Ability System
> Cards with special effects that cascade like Balatro.

- [ ] `engine/abilities/ability.ts` — Ability interface
- [ ] `engine/abilities/implementations.ts` — Core abilities: stonewall, fire_amplifier, tidal_shield, earthquake, dodge, cleanse
- [ ] `engine/abilities/registry.ts` — resolveAbilities pipeline (own ability → reactions from drawn cards → encounter modifiers)
- [ ] `engine/__tests__/abilities.test.ts` — Each ability in isolation, cascading resolution, encounter modifier interaction

## Phase 5: Multiplayer Round & Action Resolver
> Multiple players taking turns in a round, wired through the action resolver.

- [ ] `engine/models/round.ts` — Round state, turn order
- [ ] `engine/action-resolver.ts` — Central dispatcher: resolveAction(state, action) → [newState, events]
- [ ] `engine/phases/lobby.ts` — handleJoin, handleStart (creates initial game state, generates map, deals starter decks)
- [ ] `engine/__tests__/action-resolver.test.ts` — Multi-player sequential turns, round completion, phase transitions

## Phase 6: Map & Voting
> Roguelike map generation and group voting on path.

- [ ] `engine/models/map.ts` — MapNode helpers
- [ ] `engine/map-generator.ts` — generateMap (DAG with tiers, node types, connectivity validation)
- [ ] `engine/phases/voting.ts` — handleVote, tally, tiebreak, transition to next node's phase
- [ ] `engine/__tests__/map-generator.test.ts` — Valid DAG, all nodes reachable, type distribution
- [ ] `engine/__tests__/voting.test.ts` — Majority wins, tiebreak, all-voted detection

## Phase 7: Shop & Rest
> Between-encounter phases for deck building.

- [ ] `engine/models/shop.ts` — Shop state, card generation, pricing
- [ ] `engine/phases/shopping.ts` — handleBuy, handleSell, currency validation
- [ ] `engine/phases/resting.ts` — handleRest (threshold boost, card removal, preview)
- [ ] `engine/phases/game-over.ts` — Final scoring, winner determination
- [ ] `engine/__tests__/shop.test.ts` — Buy/sell, currency, stock depletion

## Phase 8: Full Game State Machine
> Wire all phases into a complete game loop.

- [ ] Phase transition logic: lobby → encounter → voting → shop/rest/event → ... → boss → game_over
- [ ] `engine/__tests__/full-game.test.ts` — Programmatic bot plays entire run end-to-end

## Phase 9: PartyKit Server Integration
> Thin server wrapper around the engine.

- [ ] `party/server.ts` — Full implementation: onStart, onConnect, onMessage, onClose
- [ ] State sync on connect, action dispatch through engine, event broadcasting
- [ ] State persistence to Durable Object storage for crash recovery
- [ ] Session token validation for reconnection

## Phase 10: Client Connection & Svelte Frontend
> TV display and phone controller UIs.

- [ ] `src/lib/connection.ts` — WebSocket wrapper with reconnection
- [ ] `src/lib/stores.ts` — Svelte stores for game state
- [ ] `src/lib/router.ts` — Hash-based routing (#/play/XXXX, #/table/XXXX)
- [ ] Phone: JoinScreen, DrawControls, VoteControls, ShopControls, DeckView
- [ ] TV: Lobby, GameBoard, MapView, VoteResults, Scoreboard
- [ ] Shared: Card component, PlayerIcon, QRCode

## Phase 11: Polish & Deploy
> Final touches for a playable game.

- [ ] Reconnection handling (session tokens, state recovery)
- [ ] Animation/event queue on frontend
- [ ] Remaining abilities (rebirth, gamble, phoenix, legendary cards)
- [ ] Balancing and playtesting
- [ ] GitHub Pages deployment for frontend
- [ ] Production deploy to Cloudflare

---

## Current Goal

Get through Phases 1–9: a deployed server where we can test and verify individual engine pieces via WebSocket messages, before building the full UI.
