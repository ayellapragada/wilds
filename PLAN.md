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

# Next Up

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

**Phase E** — Marketplace & Rest Stops. Core game loop (lobby → route → world → vote → route → champion → game over) is working end-to-end. 112 tests passing.

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
