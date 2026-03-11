# Wild Wilds: Game Completeness Design

## Goal

Make Wild Wilds feel like a polished, complete party game — not a prototype. Target: playtest-ready with friends + impressive demo. Focus on dramatic pacing, content variety, tension indicators, and a satisfying ending.

## Constraints

- No sound/music in this iteration
- No changes to map length or tier count (tuning knob for later)
- Visual juice over new mechanical depth
- Engine stays pure (no I/O, no framework imports)

---

## 1. Dramatic Pacing

Every phase should have a buildup-moment-reaction rhythm instead of instant resolution. The game is simultaneous — drama is personal (phone) and collective (TV).

### Route Phase (Phone)

- **Card reveal delay**: when a player hits, a configurable delay (default 0.75s) before the drawn card is revealed on their phone. Show card back during the wait. Delay is a frontend constant (not engine — the engine processes `hit` synchronously, delay is purely visual).
- **Bust moment**: on bust, screen shake + red flash. Brief pause (~1s) before showing the penalty choice screen. The bust should feel like an event, not a transition.
- **Stop celebration**: positive visual feedback on phone when banking a good distance (e.g. brief green flash, distance number animating up).

### Route Phase (TV)

- **Trail marker animation**: when players stop or bust, their marker advances spot-by-spot on the trail rather than jumping. Each spot takes ~200ms, capped at 1.5s total animation time (speed up for large jumps). Lets the group react to who's pulling ahead.

### Hub Phase

- **Card reveal animation**: free picks and shop cards appear one at a time with a flip animation on the player's phone, not all at once. ~300ms between cards.
- **"Everyone ready" countdown**: when the last player confirms, TV shows a 3-2-1 countdown before transitioning to the next phase. This is purely a frontend concern — the engine transitions immediately on `all_ready`, and the TV delays its visual transition by ~3s.

### World Vote Phase

- **Blind voting**: vote choices are not shown to other players until everyone has voted. TV shows "waiting for votes" with a count of who has voted. Implementation: the TV view state builder redacts the `votes` map until all trainers have voted — no engine changes needed, just view filtering.
- **Vote reveal**: once all votes are in, TV reveals all votes simultaneously, then announces the winning route with a brief dramatic beat.

### Phase Transitions

- Brief transition screens on TV between phases. Simple text ("Entering the Hub...", "The path ahead...", "A storm is brewing...") with ~1.5s display time. Gives breathing room between phases.

---

## 2. Node Bonuses

The map generator already assigns bonus types to nodes. Implement the three types: events, rest stops, and marketplace.

### Game Loop (Updated)

```
[Event if node has one] -> Route -> Hub (always) -> [Rest Stop or Marketplace if node has one] -> World Vote -> repeat
```

Events happen before the route (prime strategy). Rest stops and marketplace happen after the hub (reward for surviving).

### Events

Group modifiers announced on TV before the route begins. Apply to all trainers for the duration of that route.

Examples:
- **Sandstorm**: all trainers get +1 cost per card this route
- **Tailwind**: all trainers get +2 distance per card this route
- **Type Surge [type]**: Pokemon of the specified type get double distance bonus
- **Fog**: bust threshold is hidden on phone until you're within 2 of it
- **Bounty**: currency rewards on the trail are doubled this route

Events are selected randomly from a pool, weighted by tier (harder events at higher tiers). Each node in the map can have zero or one event.

Some events map to existing `RouteModifier` types (Sandstorm = `cost_bonus`, Tailwind = `distance_bonus`, Type Surge = `type_bonus`). These reuse the modifier system with an added presentation layer. Other events require new mechanics:

- **Fog**: new event type. The phone view state conditionally hides the bust threshold unless the trainer is within 2 of it.
- **Bounty**: new event type. Modifies currency calculation during trail reward distribution.

Engine representation: an `event` field on the game state, defined as a discriminated union:

```typescript
type RouteEvent =
  | { type: "modifier"; modifier: RouteModifier; name: string; description: string }
  | { type: "fog"; name: string; description: string }
  | { type: "bounty"; name: string; description: string }
```

**Phase flow for events**: a new `"event"` phase is added to `GamePhase`. When a node has an event, the game transitions to `"event"` phase before `"route"` (both from `handleStart` for the first node and from `handleVote` for subsequent nodes). The event phase is display-only — the frontend auto-dispatches a `continue_event` action after a configurable delay (e.g. 3s), or the host can press "continue" to dispatch it early. The engine handles `continue_event` by transitioning to `"route"`. This keeps the engine pure — the delay is a frontend concern.

```typescript
| { type: "continue_event"; trainerId: string }
```

### Rest Stops

Appear after the hub on certain nodes. Each player picks one option:

- **Remove a card**: choose one Pokemon from your deck to permanently remove (true removal from all piles — not moved to discard). Deck thinning for strategy.
- **Scout ahead**: preview your top 3 draw pile cards (or all remaining if fewer than 3). Information advantage. The engine emits a `scout_result` event containing the previewed card IDs, which the phone view displays.
- **Reinforce**: next route, your bust threshold gets +1. Stored as `pendingThresholdBonus: number` on the `Trainer` type, consumed and cleared when entering the next route.

All players must make their choice before proceeding to world vote (same pattern as hub confirmation).

Engine representation: a new `"rest_stop"` phase added to `GamePhase`. Transitions from hub confirmation when the current node has a rest stop bonus. Action types:

```typescript
| { type: "rest_stop_choice"; trainerId: string; choice: "remove"; pokemonId: string }
| { type: "rest_stop_choice"; trainerId: string; choice: "scout" }
| { type: "rest_stop_choice"; trainerId: string; choice: "reinforce" }
```

When all trainers have chosen, transitions to `"world"` phase.

### Marketplace

Upgraded shop that appears after the hub on certain nodes:

- Larger selection: 5-6 cards instead of 3-4
- Guaranteed one rare or legendary card
- Same purchasing mechanics as the regular hub shop

Engine representation: marketplace stays as phase `"hub"` (not a separate phase) with an `isMarketplace: boolean` flag on `HubState`. This avoids needing to modify phase guards in `handleSelectPokemon` and `handleConfirmSelections`. The flag controls `generateShopPokemon` parameters (more cards, guaranteed rare). After hub confirmation, the transition logic checks the node's bonus type: if rest stop, go to `"rest_stop"`; if marketplace, the marketplace was already part of the hub; otherwise go to `"world"`.

---

## 3. Tension Indicators

Make the push-your-luck tension visible on both screens.

### Phone (During Route)

- **Danger meter**: vertical bar on the right side of the phone screen. Fills as accumulated cost approaches bust threshold. Color transitions: green (0-50%) -> yellow (50-75%) -> red (75-100%). Pulses when within 1-2 cost of the bust threshold.
- **"On the edge" state**: when within 1-2 of bust threshold, the hit button visually changes — turns red or shakes subtly. Makes the risk visceral.
- **Bust probability prominence**: the existing white-out % display gets larger and changes color as it climbs. Small and gray at low %, large and red at high %.

### TV (During Route)

- **Trainer risk indicators**: next to each trainer's marker on the trail, a subtle color dot or glow: green (safe, <50% cost), yellow (risky, 50-75%), red (near bust, >75%). Does not reveal exact numbers — just vibes. Adds tension for spectators watching the TV.

### Data Flow

The danger meter and bust probability are derived values (cost / threshold) computed in the frontend — no engine changes needed. Color thresholds (green/yellow/red) are frontend constants.

The TV risk indicators require the TV view state builder to include a `riskLevel: "safe" | "risky" | "danger"` enum per trainer — derived from cost/threshold ratio without revealing exact numbers.

---

## 4. Game Over Ceremony

The ending should be a memorable moment, not a flat announcement.

### TV Screen

- **Final standings reveal**: players ranked by score, revealed bottom-to-top with ~1s delays between each. Like Mario Party star counting.
- **Run stats**: displayed per player after the reveal:
  - Total cards drawn
  - Times busted
  - Highest single-route distance
  - Total currency earned
- **Superlatives**: 2-3 fun awards generated from the stats:
  - "Daredevil" — most busts
  - "Safe Hands" — fewest busts
  - "High Roller" — most currency earned
  - "Lucky Draw" — highest single card distance drawn
  - "Collector" — largest final deck size
  - Select the most interesting/distinctive ones (avoid giving everyone an award)
- **Winner highlight**: #1 player's trainer sprite displayed prominently. Visual celebration (particles, glow, or equivalent CSS animation).

### Phone Screen

- Your personal stats for the run
- Your superlative if you earned one
- "Play Again" button that returns everyone to lobby

### Engine Requirements

- Track cumulative stats per trainer throughout the game: cards drawn, bust count, max single-route distance, total currency earned, max single card distance (effective distance after modifiers/abilities), final deck size.
- Stats are a new field on the `Trainer` interface, initialized in `handleStart` (not during lobby — stats are game-only). Type:

```typescript
type TrainerStats = {
  cardsDrawn: number
  bustCount: number
  maxRouteDistance: number
  totalCurrencyEarned: number
  maxCardDistance: number
  finalDeckSize: number  // computed at game over
}
```

- Stats are updated by the action resolver: `handleHit` increments `cardsDrawn` and updates `maxCardDistance`, `handleBust` increments `bustCount`, `handleStop` updates `maxRouteDistance`, currency tracking in `handleStop`/`handleBust`.
- Stats are included in `TrainerPublicInfo` (TV view) only during `"game_over"` phase. During gameplay, stats are private to each trainer's phone view.
- Superlative calculation is a pure function: takes all trainer stats, returns a list of `(trainerId, award)` pairs. Awards at most `floor(playerCount / 2)` superlatives, choosing the ones with the largest margin between winner and runner-up.
- Game over state includes the stats and superlatives.

### Play Again

A new `play_again` action resets the game state back to lobby phase, preserving trainer names and avatars but clearing scores, decks, map, and stats. All connected trainers return to lobby.

```typescript
| { type: "play_again"; trainerId: string }
```

---

## 5. New Types Summary

All new types belong in `engine/types.ts`.

### GamePhase (extended)

```typescript
export type GamePhase = "lobby" | "event" | "route" | "hub" | "rest_stop" | "world" | "game_over";
```

Note: marketplace is not a separate phase — it uses `"hub"` with `isMarketplace` flag.

### New Action variants

```typescript
| { type: "continue_event"; trainerId: string }
| { type: "rest_stop_choice"; trainerId: string; choice: "remove"; pokemonId: string }
| { type: "rest_stop_choice"; trainerId: string; choice: "scout" }
| { type: "rest_stop_choice"; trainerId: string; choice: "reinforce" }
| { type: "play_again"; trainerId: string }
```

### New Event types

```typescript
| { type: "event_started"; event: RouteEvent }
| { type: "rest_stop_entered" }
| { type: "rest_stop_choice_made"; trainerId: string; choice: string }
| { type: "scout_result"; trainerId: string; pokemonIds: string[] }
| { type: "play_again" }
```

### RouteEvent

```typescript
type RouteEvent =
  | { type: "modifier"; modifier: RouteModifier; name: string; description: string }
  | { type: "fog"; name: string; description: string }
  | { type: "bounty"; name: string; description: string }
```

### TrainerStats

```typescript
type TrainerStats = {
  cardsDrawn: number
  bustCount: number
  maxRouteDistance: number
  totalCurrencyEarned: number
  maxCardDistance: number
  finalDeckSize: number
}
```

### Trainer additions

- `stats: TrainerStats` — initialized in `handleStart`
- `pendingThresholdBonus: number` — consumed when entering next route

### HubState addition

- `isMarketplace: boolean`

### TrainerPublicInfo addition

- `stats?: TrainerStats` — populated only during `"game_over"` phase
- `riskLevel: "safe" | "risky" | "danger"` — populated during `"route"` phase

---

## Implementation Priority

1. **Tension indicators** (danger meter, risk dots on TV) — small scope, big feel improvement
2. **Dramatic pacing** (card reveal delay, bust moment, phase transitions, countdown, blind voting)
3. **Game over ceremony** (stats tracking, standings reveal, superlatives)
4. **Node bonuses** (events, rest stops, marketplace) — largest scope, adds variety

Items system is deferred to a future iteration.

---

## Out of Scope

- Sound/music
- Map length changes
- Items system
- Turn order mechanics
- Timer on hit/stop decisions
- Simultaneous vs turn-by-turn mode changes
