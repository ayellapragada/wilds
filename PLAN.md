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

# Completed

## Phase A–D: Core Engine ✅

All done. Lobby, route (push-your-luck), hub (free picks + shop), world (voting + map traversal), game_over.

- Action resolver handles all 8 actions across 5 phases
- Full phase transitions: lobby → route → hub → world → route → ... → champion → game_over
- Ability system: on_draw, on_bust triggers with conditions and effects
- Procedural map generator (tiered DAG with node types and Pokemon pools)
- Hub: free picks for non-busted trainers, shop with rarity-weighted stock
- World: weighted-random vote resolution, map advancement
- TV screens for lobby/route/hub/world implemented
- Sandbox dev tool for local testing without server

---

## Phase E.1: Engine Gaps ✅

> Wire up unused engine mechanics with real content. 158 tests passing.

- Per-route bust threshold — RouteNode defines threshold (start=8, regular=7, elite=5-6, champion=5), trainers reset on route start
- `end_of_round` ability trigger — fires in handleStop and handleBustPenalty on all drawn Pokemon
- `bonus_currency` effect — applied to trainer currency on stop; on bust, only with keep_currency choice
- New Pokemon: Meowth (common, +1 currency/round), Aipom (uncommon, +3 if 4+ draws), Persian (rare, +5 if 5+ draws + on_draw distance)
- Route modifiers — generated per node (elite: cost/threshold penalty; tier 5+: distance bonus; random: type bonus), applied in handleHit
- Removed `baseBustThreshold` from Trainer (route defines the base)

---

# Next Up

---

## Phase E.2: Marketplace & Rest Stops

> Between-route phases for team building. Design questions still open.

- [ ] Node bonus types — `marketplace`, `rest_stop`, `event` handlers (deferred from E.1)
- [ ] Marketplace state, creature generation, pricing
- [ ] Buy/sell creatures, currency validation
- [ ] Rest stop logic (threshold boost, creature removal, preview — details TBD)
- [ ] Final scoring refinements for game_over

---

## Phase F: Full Integration Test (deferred)

> Programmatic bot plays entire run end-to-end.

- [ ] `engine/__tests__/full-game.test.ts` — Bot plays complete game loop

---

## Phase G: PartyKit Server (full)

> Upgrade the thin wrapper to handle the full game.

- [ ] State persistence to Durable Object storage for crash recovery
- [ ] Session token validation for reconnection
- [ ] State sync sends appropriate view per connection (TV vs phone)

---

## Phase H: Svelte Frontend

> TV display and phone controller UIs.

- [ ] **Phone screens:** JoinScreen, HitOrStop, BustChoice, WorldControls (vote + marketplace + team), DeckView
- [ ] **TV screens:** game_over screen (missing), polish existing screens
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

**Phase E.2** — Marketplace & Rest Stops (next). Phase E.1 complete. 158 tests passing.

---

## Open Design Questions

- **Marketplace specifics:** Shared stock (competitive) vs individual offers? Trading between trainers?
- **Rest stops:** Heal threshold? Remove a creature? Preview draws?
- **Events (random):** Group effects — "a storm reduces everyone's threshold by 2 next route"
- **Turn order:** Random each route? Lowest score first (catchup)?
- **Timer on HIT/STOP:** Keep pacing tight with large groups?
- **Simultaneous mode:** Everyone draws at once instead of taking turns — better for 10+ trainers?
- **Tiebreak rules:** Random among tied options? Something else?
- **Node bonus types:** What happens when you land on a marketplace/rest_stop/event node?
