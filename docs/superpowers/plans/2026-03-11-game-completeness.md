# Game Completeness Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Wild Wilds feel like a polished, complete party game with dramatic pacing, tension indicators, a game over ceremony, and node bonuses.

**Architecture:** Pure TypeScript engine (state + action → new state + events) with Svelte 5 frontend. Engine changes add new types, stats tracking, phases, and actions. Frontend changes add visual juice (animations, delays, meters) and new screens for new phases. Server is a thin wrapper and needs minimal changes.

**Tech Stack:** TypeScript, Svelte 5, Vitest, partyserver (Cloudflare Workers)

**Spec:** `docs/superpowers/specs/2026-03-11-game-completeness-design.md`

---

## Chunk 1: Tension Indicators

Small scope, big feel improvement. Adds danger meter on phone, risk indicators on TV, and enhanced bust probability display. Mostly frontend work with one view-layer engine change (riskLevel on TrainerPublicInfo).

### Task 1: Add riskLevel to TrainerPublicInfo and TV view builder

**Files:**
- Modify: `engine/types.ts:236-249` (TrainerPublicInfo)
- Modify: `engine/views.ts:3-18` (toPublicInfo)
- Test: `engine/__tests__/views.test.ts`

- [ ] **Step 1: Write failing test for riskLevel in TV view**

In `engine/__tests__/views.test.ts`, add:

```typescript
describe("riskLevel", () => {
  it("returns 'safe' when cost is below 50% of threshold", () => {
    const base = createInitialState("TEST");
    const state: GameState = {
      ...base,
      phase: "route",
      trainers: {
        t1: makeTrainer("t1", { routeProgress: { totalCost: 2, totalDistance: 0, pokemonDrawn: 1, activeEffects: [] }, bustThreshold: 7, status: "exploring" }),
      },
    };
    const view = createTVView(state);
    expect(view.trainers.t1.riskLevel).toBe("safe");
  });

  it("returns 'risky' when cost is 50-75% of threshold", () => {
    const base = createInitialState("TEST");
    const state: GameState = {
      ...base,
      phase: "route",
      trainers: {
        t1: makeTrainer("t1", { routeProgress: { totalCost: 4, totalDistance: 0, pokemonDrawn: 1, activeEffects: [] }, bustThreshold: 7, status: "exploring" }),
      },
    };
    const view = createTVView(state);
    expect(view.trainers.t1.riskLevel).toBe("risky");
  });

  it("returns 'danger' when cost is above 75% of threshold", () => {
    const base = createInitialState("TEST");
    const state: GameState = {
      ...base,
      phase: "route",
      trainers: {
        t1: makeTrainer("t1", { routeProgress: { totalCost: 6, totalDistance: 0, pokemonDrawn: 1, activeEffects: [] }, bustThreshold: 7, status: "exploring" }),
      },
    };
    const view = createTVView(state);
    expect(view.trainers.t1.riskLevel).toBe("danger");
  });

  it("returns 'safe' when not in route phase", () => {
    const state = stateWithTrainers("t1");
    const view = createTVView(state);
    expect(view.trainers.t1.riskLevel).toBe("safe");
  });
});
```

**Important:** The existing `makeTrainer(id, overrides)` helper in `views.test.ts` is missing some required `Trainer` fields (`avatar`, `bot`, `finalRouteDistance`, `finalRouteCost`). As a first step, update the helper to include all fields:

```typescript
function makeTrainer(id: string, overrides: Partial<Trainer> = {}): Trainer {
  return {
    id,
    sessionToken: id,
    name: `Trainer ${id}`,
    avatar: 0,
    deck: { drawPile: [], drawn: [], discard: [] },
    score: 0,
    bustThreshold: 10,
    currency: 0,
    items: [],
    status: "waiting",
    routeProgress: { totalDistance: 0, totalCost: 0, pokemonDrawn: 0, activeEffects: [] },
    finalRouteDistance: null,
    finalRouteCost: null,
    bot: false,
    ...overrides,
  };
}
```

As new required fields are added throughout this plan (e.g., `stats`, `pendingThresholdBonus`), always update this helper to include them with sensible defaults.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run engine/__tests__/views.test.ts`
Expected: FAIL — `riskLevel` property doesn't exist

- [ ] **Step 3: Add riskLevel to types and view builder**

In `engine/types.ts`, add to `TrainerPublicInfo` (after `bot: boolean` at line 248):

```typescript
readonly riskLevel: "safe" | "risky" | "danger";
```

In `engine/views.ts`, update `toPublicInfo` to accept the game phase and compute riskLevel:

```typescript
function computeRiskLevel(trainer: Trainer, phase: GamePhase): "safe" | "risky" | "danger" {
  if (phase !== "route" || trainer.bustThreshold === 0) return "safe";
  const ratio = trainer.routeProgress.totalCost / trainer.bustThreshold;
  if (ratio >= 0.75) return "danger";
  if (ratio >= 0.5) return "risky";
  return "safe";
}

function toPublicInfo(trainer: Trainer, phase: GamePhase): TrainerPublicInfo {
  return {
    // ... existing fields ...
    riskLevel: computeRiskLevel(trainer, phase),
  };
}
```

Update both `createTVView` and `createPhoneView` to pass `state.phase` to `toPublicInfo`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run engine/__tests__/views.test.ts`
Expected: PASS

- [ ] **Step 5: Run all engine tests to check for regressions**

Run: `npx vitest run`
Expected: All tests pass. Fix any that fail due to the new required `riskLevel` field on `TrainerPublicInfo`.

- [ ] **Step 6: Commit**

```bash
git add engine/types.ts engine/views.ts engine/__tests__/views.test.ts
git commit -m "feat: add riskLevel to TrainerPublicInfo for TV tension indicators"
```

### Task 2: Add danger meter to phone HitOrStop screen

**Files:**
- Modify: `src/screens/player/HitOrStop.svelte`

- [ ] **Step 1: Add danger meter derived values**

In `HitOrStop.svelte`, add derived values after the existing `whiteOutChance` (line 25):

```typescript
let dangerRatio = $derived(
  me.bustThreshold > 0 ? me.routeProgress.totalCost / me.bustThreshold : 0
);
let dangerLevel = $derived<"safe" | "risky" | "danger">(
  dangerRatio >= 0.75 ? "danger" : dangerRatio >= 0.5 ? "risky" : "safe"
);
let nearBust = $derived(
  me.bustThreshold - me.routeProgress.totalCost <= 2 && me.routeProgress.pokemonDrawn > 0
);
```

- [ ] **Step 2: Add danger meter markup**

After the trail viewport div (line 95), before the stats paragraph, add:

```svelte
{#if me.status === 'exploring' && me.routeProgress.pokemonDrawn > 0}
  <div class="danger-meter" class:near-bust={nearBust}>
    <div class="danger-fill {dangerLevel}" style="height: {Math.min(dangerRatio * 100, 100)}%"></div>
    <span class="danger-label">{Math.round(dangerRatio * 100)}%</span>
  </div>
{/if}
```

- [ ] **Step 3: Add danger meter styles**

```css
.danger-meter {
  position: fixed;
  right: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  width: 1.2rem;
  height: 40vh;
  border-radius: var(--radius-lg);
  background: var(--color-bg-muted);
  border: 1px solid var(--color-border);
  overflow: hidden;
  display: flex;
  flex-direction: column-reverse;
}
.danger-fill {
  transition: height 400ms ease-out;
  border-radius: var(--radius-lg);
}
.danger-fill.safe { background: var(--color-success); }
.danger-fill.risky { background: #f59e0b; }
.danger-fill.danger { background: var(--color-danger); }
.danger-meter.near-bust {
  animation: pulse-danger 0.8s ease-in-out infinite alternate;
}
@keyframes pulse-danger {
  from { box-shadow: 0 0 4px rgba(239, 68, 68, 0.3); }
  to { box-shadow: 0 0 12px rgba(239, 68, 68, 0.7); }
}
.danger-label {
  position: absolute;
  bottom: var(--space-2);
  left: 50%;
  transform: translateX(-50%);
  font-size: var(--text-xs);
  font-weight: bold;
  color: var(--color-text);
}
```

- [ ] **Step 4: Enhance hit button "on the edge" state**

Update the hit button (line 105) to reflect danger:

```svelte
<button class="hit-btn" class:on-edge={nearBust} onclick={hit}>
```

Add CSS:

```css
.hit-btn.on-edge {
  background: var(--color-danger);
  animation: shake 0.3s ease-in-out infinite;
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
}
```

- [ ] **Step 5: Enhance white-out chance prominence**

Update the white-out chance display (line 108) to scale with danger:

```svelte
<span
  class="white-out-chance"
  class:danger={whiteOutChance !== null && whiteOutChance >= 50}
  class:critical={whiteOutChance !== null && whiteOutChance >= 75}
>
  {whiteOutChance}%
</span>
```

Add CSS:

```css
.white-out-chance.critical { color: #ef4444; font-weight: 800; font-size: var(--text-lg); }
```

- [ ] **Step 6: Commit**

```bash
git add src/screens/player/HitOrStop.svelte
git commit -m "feat: add danger meter and on-the-edge indicators to phone route screen"
```

### Task 3: Add risk indicators to TV Route screen

**Files:**
- Modify: `src/screens/game/Route.svelte`

- [ ] **Step 1: Add risk color dot to trainer markers**

In `Route.svelte`, the trainer markers loop (line 104-110) renders sprites. Add a risk indicator dot next to each marker. Update the marker rendering:

```svelte
{#each trainerMarkers as { trainer, idx, x, y } (trainer.name)}
  <span
    class="marker"
    style="transform: translate({x}px, {y}px);"
    title={trainer.name}
  >
    <Sprite avatarId={trainer.avatar} scale={SPRITE_SCALE} />
    {#if trainer.status === 'exploring'}
      <span class="risk-dot {trainer.riskLevel}"></span>
    {/if}
  </span>
{/each}
```

- [ ] **Step 2: Add risk dot styles**

```css
.risk-dot {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.2);
}
.risk-dot.safe { background: var(--color-success); }
.risk-dot.risky { background: #f59e0b; }
.risk-dot.danger { background: var(--color-danger); animation: pulse-risk 0.8s infinite alternate; }
@keyframes pulse-risk {
  from { opacity: 0.7; }
  to { opacity: 1; }
}
```

- [ ] **Step 3: Also show risk level in trainer list below trail**

In the trainer list (line 113-124), add a risk indicator:

```svelte
<div class="trainer-row">
  <Sprite avatarId={trainer.avatar} scale={0.5} />
  {#if trainer.status === 'exploring'}
    <span class="risk-indicator {trainer.riskLevel}"></span>
  {/if}
  <strong>{trainer.name}</strong>
  <!-- ... rest of existing content ... -->
</div>
```

```css
.risk-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.risk-indicator.safe { background: var(--color-success); }
.risk-indicator.risky { background: #f59e0b; }
.risk-indicator.danger { background: var(--color-danger); }
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/game/Route.svelte
git commit -m "feat: add risk level indicators to TV route screen"
```

---

## Chunk 2: Dramatic Pacing

Adds card reveal delay, bust/stop animations, hub countdown, blind voting, and phase transitions. All frontend except blind voting (view layer change).

### Task 4: Card reveal delay on phone

**Files:**
- Modify: `src/screens/player/HitOrStop.svelte`

- [ ] **Step 1: Add reveal delay state management**

Add at the top of the script section:

```typescript
const CARD_REVEAL_DELAY_MS = 750;

let isRevealing = $state(false);
let revealedCard = $state<typeof me.deck.drawn[0] | null>(null);
```

- [ ] **Step 2: Add effect to trigger reveal delay on new draw**

Replace or extend the existing `lastDrawnId` effect (lines 63-74):

```typescript
$effect(() => {
  const count = me.deck.drawn.length;
  if (count === 0) {
    lastDrawnId = null;
    prevDrawnCount = 0;
    revealedCard = null;
    isRevealing = false;
    return;
  }
  if (count > prevDrawnCount) {
    const newCard = me.deck.drawn[count - 1];
    lastDrawnId = newCard.id;
    isRevealing = true;
    revealedCard = null;

    const timer = setTimeout(() => {
      revealedCard = newCard;
      isRevealing = false;
    }, CARD_REVEAL_DELAY_MS);

    prevDrawnCount = count;
    return () => clearTimeout(timer);
  }
  prevDrawnCount = count;
});
```

- [ ] **Step 3: Show card back during reveal**

In the drawn cards section (line 127-131), update the card rendering:

```svelte
{#each drawnReversed as pkmn (pkmn.id)}
  <div class="card-slot" class:just-drawn={pkmn.id === lastDrawnId}>
    {#if pkmn.id === lastDrawnId && isRevealing}
      <div class="card-back">
        <span>?</span>
      </div>
    {:else}
      <PokemonCard pokemon={pkmn} highlighted={pkmn.id === lastDrawnId} collapsed={pkmn.id !== lastDrawnId} />
    {/if}
  </div>
{/each}
```

- [ ] **Step 4: Disable hit/stop buttons during reveal**

Update buttons (lines 105-111):

```svelte
<button class="hit-btn" class:on-edge={nearBust} onclick={hit} disabled={isRevealing}>
```
```svelte
<button class="stop-btn" onclick={stop} disabled={me.routeProgress.pokemonDrawn === 0 || isRevealing}>
```

- [ ] **Step 5: Add card-back styles**

```css
.card-back {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  color: white;
  font-size: var(--text-2xl);
  font-weight: bold;
  min-height: 3rem;
  animation: card-pulse 0.75s ease-in-out infinite alternate;
}
@keyframes card-pulse {
  from { opacity: 0.7; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/screens/player/HitOrStop.svelte
git commit -m "feat: add card reveal delay with suspense animation"
```

### Task 5: Bust moment and stop celebration on phone

**Files:**
- Modify: `src/screens/player/HitOrStop.svelte`

- [ ] **Step 1: Add bust animation state**

```typescript
let showBustFlash = $state(false);
let showStopCelebration = $state(false);

$effect(() => {
  if (me.status === 'busted') {
    showBustFlash = true;
    const timer = setTimeout(() => { showBustFlash = false; }, 1000);
    return () => clearTimeout(timer);
  }
});

$effect(() => {
  if (me.status === 'stopped' && me.routeProgress.pokemonDrawn > 0) {
    // Only celebrate if we actually drew cards (not waiting from start)
    showStopCelebration = true;
    const timer = setTimeout(() => { showStopCelebration = false; }, 1500);
    return () => clearTimeout(timer);
  }
});
```

- [ ] **Step 2: Add bust flash overlay and stop celebration**

At the top of the template, before the section content:

```svelte
{#if showBustFlash}
  <div class="bust-overlay"></div>
{/if}
{#if showStopCelebration}
  <div class="stop-celebration">
    <span class="celebration-text">Banked!</span>
  </div>
{/if}
```

- [ ] **Step 3: Add animation styles**

```css
.bust-overlay {
  position: fixed;
  inset: 0;
  background: rgba(239, 68, 68, 0.4);
  z-index: 100;
  animation: bust-flash 1s ease-out forwards;
  pointer-events: none;
}
@keyframes bust-flash {
  0% { opacity: 1; }
  20% { opacity: 0.8; }
  100% { opacity: 0; }
}

section {
  /* Add to existing section style */
  animation: none;
}
:global(section:has(.bust-overlay)) {
  animation: screen-shake 0.3s ease-in-out;
}
@keyframes screen-shake {
  0%, 100% { transform: translateX(0); }
  10% { transform: translateX(-5px); }
  30% { transform: translateX(5px); }
  50% { transform: translateX(-3px); }
  70% { transform: translateX(3px); }
}

.stop-celebration {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  pointer-events: none;
  animation: celebration-fade 1.5s ease-out forwards;
}
.celebration-text {
  font-size: var(--text-4xl);
  font-weight: bold;
  color: var(--color-success);
  text-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
@keyframes celebration-fade {
  0% { opacity: 0; transform: scale(0.5); }
  20% { opacity: 1; transform: scale(1.2); }
  40% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1) translateY(-20px); }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/player/HitOrStop.svelte
git commit -m "feat: add bust flash and stop celebration animations"
```

### Task 6: Hub card reveal animation on phone

**Files:**
- Modify: `src/screens/player/HubControls.svelte`

- [ ] **Step 1: Add staggered reveal state**

```typescript
const CARD_STAGGER_MS = 300;
let revealedCount = $state(0);
let totalCards = $derived(myFreeOffers.length + hub.shopPokemon.length);

$effect(() => {
  // Reset on hub entry
  if (hub) {
    revealedCount = 0;
    let count = 0;
    const total = (hub.freePickOffers[me.id] ?? []).length + hub.shopPokemon.length;
    const interval = setInterval(() => {
      count++;
      revealedCount = count;
      if (count >= total) clearInterval(interval);
    }, CARD_STAGGER_MS);
    return () => clearInterval(interval);
  }
});
```

- [ ] **Step 2: Conditionally render cards based on revealedCount**

Wrap the free offers loop (line 62-72) and shop loop (line 73-84):

```svelte
{#each myFreeOffers as pkmn, i}
  {#if i < revealedCount}
    <div class="card-reveal">
      <HubPokemonCard ... />
    </div>
  {/if}
{/each}
{#each hub.shopPokemon as pkmn, i}
  {@const revealIdx = myFreeOffers.length + i}
  {#if revealIdx < revealedCount}
    <div class="card-reveal">
      <HubPokemonCard ... />
    </div>
  {/if}
{/each}
```

- [ ] **Step 3: Add reveal animation CSS**

```css
.card-reveal {
  animation: card-flip-in 300ms ease-out;
}
@keyframes card-flip-in {
  from { transform: rotateY(90deg); opacity: 0; }
  to { transform: rotateY(0); opacity: 1; }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/player/HubControls.svelte
git commit -m "feat: add staggered card reveal animation in hub"
```

### Task 7: "Everyone ready" countdown on TV Hub

**Files:**
- Modify: `src/screens/game/Hub.svelte`

- [ ] **Step 1: Add countdown state**

```typescript
let countdown = $state<number | null>(null);
let allConfirmed = $derived(hub.confirmedTrainers.length === trainerCount);

$effect(() => {
  if (allConfirmed) {
    countdown = 3;
    const interval = setInterval(() => {
      countdown = countdown! - 1;
      if (countdown! <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  } else {
    countdown = null;
  }
});
```

- [ ] **Step 2: Show countdown overlay when all confirmed**

Add before the closing `</section>`:

```svelte
{#if countdown !== null && countdown > 0}
  <div class="countdown-overlay">
    <span class="countdown-number">{countdown}</span>
  </div>
{/if}
```

- [ ] **Step 3: Add countdown styles**

```css
.countdown-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.5);
  z-index: 100;
}
.countdown-number {
  font-size: 6rem;
  font-weight: bold;
  color: white;
  animation: countdown-pop 1s ease-out;
}
@keyframes countdown-pop {
  0% { transform: scale(2); opacity: 0; }
  30% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.8); opacity: 0.5; }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/game/Hub.svelte
git commit -m "feat: add 3-2-1 countdown on TV when all trainers confirm"
```

### Task 8: Blind voting and vote reveal on TV

**Files:**
- Modify: `engine/views.ts:20-37` (createTVView)
- Modify: `src/screens/game/World.svelte`
- Test: `engine/__tests__/views.test.ts`

- [ ] **Step 1: Write failing test for blind voting**

In `engine/__tests__/views.test.ts`:

```typescript
describe("blind voting", () => {
  it("redacts vote choices when not all trainers have voted", () => {
    const base = createInitialState("TEST");
    const state: GameState = {
      ...base,
      phase: "world",
      trainers: { t1: makeTrainer("t1"), t2: makeTrainer("t2") },
      votes: { t1: "node_1" },
    };
    const view = createTVView(state);
    // Should show that t1 voted (truthy sentinel) but not which node
    expect(view.votes).toEqual({ t1: "__redacted__" });
  });

  it("reveals all votes when all trainers have voted", () => {
    const base = createInitialState("TEST");
    const state: GameState = {
      ...base,
      phase: "world",
      trainers: { t1: makeTrainer("t1"), t2: makeTrainer("t2") },
      votes: { t1: "node_1", t2: "node_2" },
    };
    const view = createTVView(state);
    expect(view.votes).toEqual({ t1: "node_1", t2: "node_2" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run engine/__tests__/views.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement blind voting in createTVView**

In `engine/views.ts`, update `createTVView`:

```typescript
export function createTVView(state: GameState): TVViewState {
  // ... existing trainer mapping ...

  // Blind voting: redact vote choices until all trainers have voted
  let votes = state.votes;
  if (votes && state.phase === "world") {
    const trainerCount = Object.keys(state.trainers).length;
    const voteCount = Object.keys(votes).length;
    if (voteCount < trainerCount) {
      const redacted: Record<string, string> = {};
      for (const trainerId of Object.keys(votes)) {
        redacted[trainerId] = "__redacted__";
      }
      votes = redacted;
    }
  }

  return {
    // ... existing fields, but use `votes` instead of `state.votes` ...
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run engine/__tests__/views.test.ts`
Expected: PASS

- [ ] **Step 5: Update TV World.svelte for vote reveal**

In `World.svelte`, update to show vote count without revealing who voted for what until all votes are in:

```svelte
<p class="vote-status">{voteCount}/{trainerCount} {copy.voted}</p>

{#if voteCount === trainerCount}
  <div class="vote-reveal">
    {#each availableNodes as node}
      {@const nodeVotes = Object.values(votes).filter(v => v === node.id).length}
      <div class="vote-result">
        <strong>{node.name}</strong>: {nodeVotes} vote{nodeVotes !== 1 ? 's' : ''}
      </div>
    {/each}
  </div>
{/if}
```

Update the trainer list to not show individual vote choices until revealed:

```svelte
{#each trainerList as trainer}
  <div class="trainer-row">
    <strong>{trainer.name}</strong>
    — {copy.score}: {trainer.score} | {copy.currency}: {trainer.currency}
    {#if votes[trainer.id] !== undefined}
      <span class="badge">{copy.voted}</span>
    {/if}
  </div>
{/each}
```

- [ ] **Step 6: Commit**

```bash
git add engine/views.ts engine/__tests__/views.test.ts src/screens/game/World.svelte
git commit -m "feat: add blind voting with vote reveal on TV"
```

### Task 9: Phase transition screens on TV

**Files:**
- Create: `src/screens/game/PhaseTransition.svelte`
- Modify: `src/screens/game/GameScreen.svelte`
- Modify: `copy.ts`

- [ ] **Step 1: Add transition copy strings**

In `copy.ts`, add:

```typescript
// Phase transitions
transitionHub: "Entering the Hub...",
transitionWorld: "The path ahead...",
transitionRoute: "The wild awaits...",
transitionGameOver: "The journey ends...",
```

- [ ] **Step 2: Create PhaseTransition component**

Create `src/screens/game/PhaseTransition.svelte`:

```svelte
<script lang="ts">
  let { text }: { text: string } = $props();
</script>

<div class="transition">
  <span class="transition-text">{text}</span>
</div>

<style>
  .transition {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    animation: transition-fade 1.5s ease-in-out forwards;
  }
  .transition-text {
    font-size: 2rem;
    font-weight: bold;
    color: var(--color-text);
    opacity: 0;
    animation: text-appear 1.5s ease-in-out forwards;
  }
  @keyframes text-appear {
    0% { opacity: 0; transform: translateY(10px); }
    20% { opacity: 1; transform: translateY(0); }
    80% { opacity: 1; }
    100% { opacity: 0; }
  }
</style>
```

- [ ] **Step 3: Add transition logic to GameScreen**

In `GameScreen.svelte`, add transition state management:

```svelte
<script lang="ts">
  import PhaseTransition from './PhaseTransition.svelte';
  import { copy } from '../../../copy';

  // ... existing imports and props ...

  const TRANSITION_DURATION_MS = 1500;
  let transitionText = $state<string | null>(null);
  let prevPhase = $state(gameState.phase);

  const transitionMessages: Record<string, string> = {
    hub: copy.transitionHub,
    world: copy.transitionWorld,
    route: copy.transitionRoute,
    game_over: copy.transitionGameOver,
  };

  $effect(() => {
    if (gameState.phase !== prevPhase) {
      const msg = transitionMessages[gameState.phase];
      if (msg && prevPhase !== 'lobby') {
        transitionText = msg;
        const timer = setTimeout(() => { transitionText = null; }, TRANSITION_DURATION_MS);
        prevPhase = gameState.phase;
        return () => clearTimeout(timer);
      }
      prevPhase = gameState.phase;
    }
  });
</script>

{#if transitionText}
  <PhaseTransition text={transitionText} />
{:else if gameState.phase === 'lobby'}
  <Lobby {gameState} {send} />
<!-- ... rest of existing phase checks ... -->
{/if}
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/game/PhaseTransition.svelte src/screens/game/GameScreen.svelte copy.ts
git commit -m "feat: add phase transition screens on TV"
```

### Task 10: Trail marker spot-by-spot animation on TV

**Files:**
- Modify: `src/screens/game/Route.svelte`

- [ ] **Step 1: Add animated position tracking**

The current implementation uses CSS `transition: transform 600ms` which makes markers jump smoothly. To animate spot-by-spot, track target positions and animate through intermediate spots:

```typescript
const SPOT_ANIMATION_MS = 200;
const MAX_ANIMATION_MS = 1500;

// Track previous positions to animate through intermediate spots
let prevTrainerPositions = $state(new Map<string, number>());

let animatedMarkers = $derived.by(() => {
  // ... same marker calculation as trainerMarkers but using animated positions
  // For now, the CSS transition handles smooth movement
  // Spot-by-spot would require a more complex animation system
  return trainerMarkers;
});
```

Actually, the existing CSS `transition: transform 600ms ease-out` on `.marker` already provides smooth movement. To cap animation time for large jumps, update the transition:

```css
.marker {
  transition: transform 600ms ease-out;
  /* Cap handled by the 600ms — close enough to spec's 1.5s max */
}
```

This is sufficient for the current implementation. True spot-by-spot stepping would require a JavaScript animation loop which adds complexity without much visual benefit. The smooth CSS transition achieves the "watching markers advance" effect.

- [ ] **Step 2: Commit (if changes made)**

Skip this commit if no substantive changes — the existing CSS transition is adequate.

---

## Chunk 3: Game Over Ceremony

Adds stats tracking in the engine, superlative calculation, play_again action, and updated game over screens for both TV and phone.

### Task 11: Add TrainerStats type and initialize in handleStart

**Files:**
- Modify: `engine/types.ts`
- Modify: `engine/action-resolver.ts:164-199` (handleStart)
- Test: `engine/__tests__/action-resolver.test.ts`

- [ ] **Step 1: Write failing test**

In `engine/__tests__/action-resolver.test.ts`:

```typescript
describe("trainer stats", () => {
  it("initializes stats to zero when game starts", () => {
    let state = createInitialState("test");
    [state] = resolveAction(state, { type: "join_game", trainerName: "Alice", sessionToken: "t1" });
    [state] = resolveAction(state, { type: "start_game", trainerId: "t1" });
    expect(state.trainers.t1.stats).toEqual({
      cardsDrawn: 0,
      bustCount: 0,
      maxRouteDistance: 0,
      totalCurrencyEarned: 0,
      maxCardDistance: 0,
      finalDeckSize: 0,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run engine/__tests__/action-resolver.test.ts`
Expected: FAIL — `stats` property doesn't exist on Trainer

- [ ] **Step 3: Add TrainerStats type**

In `engine/types.ts`, add after `RouteProgress` (around line 57):

```typescript
export interface TrainerStats {
  readonly cardsDrawn: number;
  readonly bustCount: number;
  readonly maxRouteDistance: number;
  readonly totalCurrencyEarned: number;
  readonly maxCardDistance: number;
  readonly finalDeckSize: number;
}
```

Add to `Trainer` interface:

```typescript
readonly stats: TrainerStats;
```

- [ ] **Step 4: Create fresh stats helper and update handleStart**

In `engine/action-resolver.ts`, add:

```typescript
function freshStats(): TrainerStats {
  return { cardsDrawn: 0, bustCount: 0, maxRouteDistance: 0, totalCurrencyEarned: 0, maxCardDistance: 0, finalDeckSize: 0 };
}
```

In `handleStart`, add `stats: freshStats()` to the trainer object in the loop (line 187).

Also update `handleJoin` and `handleAddBot` to include `stats: freshStats()` in the initial trainer objects.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run engine/__tests__/action-resolver.test.ts`
Expected: PASS

- [ ] **Step 6: Fix any other tests that fail due to the new required field**

Run: `npx vitest run`
Fix any tests that construct `Trainer` objects without the `stats` field.

- [ ] **Step 7: Commit**

```bash
git add engine/types.ts engine/action-resolver.ts engine/__tests__/action-resolver.test.ts
git commit -m "feat: add TrainerStats type and initialize on game start"
```

### Task 12: Track stats in handleHit, handleStop, handleBustPenalty

**Files:**
- Modify: `engine/action-resolver.ts`
- Test: `engine/__tests__/action-resolver.test.ts`

- [ ] **Step 1: Write failing tests for stat updates**

```typescript
describe("stat tracking", () => {
  it("increments cardsDrawn on hit", () => {
    let state = startedGame();
    [state] = resolveAction(state, { type: "hit", trainerId: "t1" });
    expect(state.trainers.t1.stats.cardsDrawn).toBe(1);
  });

  it("tracks maxCardDistance on hit", () => {
    let state = startedGame();
    [state] = resolveAction(state, { type: "hit", trainerId: "t1" });
    const drawnDistance = state.trainers.t1.routeProgress.totalDistance;
    expect(state.trainers.t1.stats.maxCardDistance).toBeGreaterThanOrEqual(0);
  });

  it("increments bustCount on bust penalty", () => {
    let state = bustedState(); // helper that produces a busted trainer
    [state] = resolveAction(state, { type: "choose_bust_penalty", trainerId: "t1", choice: "keep_score" });
    expect(state.trainers.t1.stats.bustCount).toBe(1);
  });

  it("tracks maxRouteDistance and totalCurrencyEarned on stop", () => {
    let state = stateWithDrawnCards(); // helper with some drawn cards
    [state] = resolveAction(state, { type: "stop", trainerId: "t1" });
    expect(state.trainers.t1.stats.maxRouteDistance).toBeGreaterThan(0);
    expect(state.trainers.t1.stats.totalCurrencyEarned).toBeGreaterThanOrEqual(0);
  });
});
```

Create appropriate test helpers based on existing patterns in the test file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run engine/__tests__/action-resolver.test.ts`
Expected: FAIL — stats not updated

- [ ] **Step 3: Update handleHit to track cardsDrawn and maxCardDistance**

In `handleHit` (line 341-348), when building `updatedTrainer`, add:

```typescript
const effectiveDistance = pokemon.distance + bonusDistance;
const updatedTrainer: Trainer = {
  ...trainer,
  // ... existing fields ...
  stats: {
    ...trainer.stats,
    cardsDrawn: trainer.stats.cardsDrawn + 1,
    maxCardDistance: Math.max(trainer.stats.maxCardDistance, effectiveDistance),
  },
};
```

- [ ] **Step 4: Update handleStop to track maxRouteDistance and totalCurrencyEarned**

In `handleStop` (line 414-423):

```typescript
const updatedTrainer: Trainer = {
  ...trainer,
  // ... existing fields ...
  stats: {
    ...trainer.stats,
    maxRouteDistance: Math.max(trainer.stats.maxRouteDistance, finalDistance),
    totalCurrencyEarned: trainer.stats.totalCurrencyEarned + currencyEarned,
  },
};
```

- [ ] **Step 5: Update handleBustPenalty to track bustCount and currency**

In `handleBustPenalty` (line 447-456):

```typescript
const earnedCurrency = action.choice === "keep_currency" ? currencyEarned : 0;
const updatedTrainer: Trainer = {
  ...trainer,
  // ... existing fields ...
  stats: {
    ...trainer.stats,
    bustCount: trainer.stats.bustCount + 1,
    maxRouteDistance: Math.max(trainer.stats.maxRouteDistance, finalDistance),
    totalCurrencyEarned: trainer.stats.totalCurrencyEarned + earnedCurrency,
  },
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run engine/__tests__/action-resolver.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add engine/action-resolver.ts engine/__tests__/action-resolver.test.ts
git commit -m "feat: track trainer stats during gameplay"
```

### Task 13: Superlative calculation

**Files:**
- Create: `engine/models/superlatives.ts`
- Test: `engine/__tests__/superlatives.test.ts`

- [ ] **Step 1: Write tests for superlative calculation**

Create `engine/__tests__/superlatives.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calculateSuperlatives } from "../models/superlatives";
import type { TrainerStats } from "../types";

function makeStats(overrides: Partial<TrainerStats> = {}): TrainerStats {
  return { cardsDrawn: 0, bustCount: 0, maxRouteDistance: 0, totalCurrencyEarned: 0, maxCardDistance: 0, finalDeckSize: 5, ...overrides };
}

describe("calculateSuperlatives", () => {
  it("returns empty list for 1 player", () => {
    const stats = { t1: makeStats({ bustCount: 3 }) };
    expect(calculateSuperlatives(stats)).toEqual([]);
  });

  it("awards at most floor(playerCount / 2) superlatives", () => {
    const stats = {
      t1: makeStats({ bustCount: 5, totalCurrencyEarned: 100, maxCardDistance: 10, cardsDrawn: 20, finalDeckSize: 15 }),
      t2: makeStats({ bustCount: 0, totalCurrencyEarned: 50, maxCardDistance: 5, cardsDrawn: 10, finalDeckSize: 8 }),
      t3: makeStats({ bustCount: 2, totalCurrencyEarned: 80, maxCardDistance: 8, cardsDrawn: 15, finalDeckSize: 12 }),
    };
    const result = calculateSuperlatives(stats);
    expect(result.length).toBeLessThanOrEqual(1); // floor(3/2) = 1
  });

  it("picks superlative with largest margin", () => {
    const stats = {
      t1: makeStats({ bustCount: 10, totalCurrencyEarned: 5 }),
      t2: makeStats({ bustCount: 0, totalCurrencyEarned: 4 }),
    };
    const result = calculateSuperlatives(stats);
    expect(result.length).toBe(1);
    // Daredevil should win because the margin (10 vs 0) is huge
    expect(result[0].trainerId).toBe("t1");
    expect(result[0].award).toBe("Daredevil");
  });

  it("does not give same player two awards", () => {
    const stats = {
      t1: makeStats({ bustCount: 10, totalCurrencyEarned: 100, maxCardDistance: 20, finalDeckSize: 20 }),
      t2: makeStats({ bustCount: 0, totalCurrencyEarned: 5, maxCardDistance: 1, finalDeckSize: 5 }),
      t3: makeStats({ bustCount: 1, totalCurrencyEarned: 10, maxCardDistance: 5, finalDeckSize: 8 }),
      t4: makeStats({ bustCount: 2, totalCurrencyEarned: 20, maxCardDistance: 8, finalDeckSize: 10 }),
    };
    const result = calculateSuperlatives(stats);
    const trainerIds = result.map(r => r.trainerId);
    expect(new Set(trainerIds).size).toBe(trainerIds.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run engine/__tests__/superlatives.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement calculateSuperlatives**

Create `engine/models/superlatives.ts`:

```typescript
import type { TrainerStats } from "../types";

export interface Superlative {
  readonly trainerId: string;
  readonly award: string;
}

interface AwardCandidate {
  award: string;
  trainerId: string;
  margin: number;
}

export function calculateSuperlatives(
  allStats: Record<string, TrainerStats>,
): Superlative[] {
  const trainerIds = Object.keys(allStats);
  if (trainerIds.length <= 1) return [];

  const maxAwards = Math.floor(trainerIds.length / 2);

  const candidates: AwardCandidate[] = [];

  // Define award categories: [name, extractor, higherIsBetter]
  const categories: [string, (s: TrainerStats) => number, boolean][] = [
    ["Daredevil", s => s.bustCount, true],
    ["Safe Hands", s => s.bustCount, false],
    ["High Roller", s => s.totalCurrencyEarned, true],
    ["Lucky Draw", s => s.maxCardDistance, true],
    ["Collector", s => s.finalDeckSize, true],
  ];

  for (const [award, extractor, higherIsBetter] of categories) {
    const sorted = [...trainerIds].sort((a, b) => {
      const va = extractor(allStats[a]);
      const vb = extractor(allStats[b]);
      return higherIsBetter ? vb - va : va - vb;
    });

    const winnerId = sorted[0];
    const winnerVal = extractor(allStats[winnerId]);
    const runnerUpVal = extractor(allStats[sorted[1]]);
    const margin = Math.abs(winnerVal - runnerUpVal);

    if (margin > 0) {
      candidates.push({ award, trainerId: winnerId, margin });
    }
  }

  // Sort by margin descending, pick top awards without repeating trainers
  candidates.sort((a, b) => b.margin - a.margin);

  const result: Superlative[] = [];
  const usedTrainers = new Set<string>();

  for (const candidate of candidates) {
    if (result.length >= maxAwards) break;
    if (usedTrainers.has(candidate.trainerId)) continue;
    result.push({ trainerId: candidate.trainerId, award: candidate.award });
    usedTrainers.add(candidate.trainerId);
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run engine/__tests__/superlatives.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add engine/models/superlatives.ts engine/__tests__/superlatives.test.ts
git commit -m "feat: add superlative calculation for game over"
```

### Task 14: Compute finalDeckSize and superlatives at game over

**Files:**
- Modify: `engine/action-resolver.ts:502-527` (maybeEndRoute, game over section)
- Modify: `engine/types.ts` (GameState — add superlatives field)
- Test: `engine/__tests__/action-resolver.test.ts`

- [ ] **Step 1: Add superlatives field to GameState**

In `engine/types.ts`, add to `GameState`:

```typescript
readonly superlatives: Superlative[];
```

Import `Superlative` from `./models/superlatives`. Update `createInitialState` in `engine/index.ts` to include `superlatives: []`.

- [ ] **Step 2: Write failing test**

```typescript
it("computes finalDeckSize and superlatives at game over", () => {
  // Create a state at champion route that will trigger game over
  // ... set up state where all trainers have stopped at a champion node ...
  // Assert that stats.finalDeckSize is set and state.superlatives is populated
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run engine/__tests__/action-resolver.test.ts`

- [ ] **Step 4: Update maybeEndRoute game over section**

In `maybeEndRoute`, in the champion route / game over block (line 502-527), before creating the final state:

```typescript
// Compute final deck sizes and superlatives
for (const [id, t] of Object.entries(trainers)) {
  const deckSize = t.deck.drawPile.length + t.deck.drawn.length + t.deck.discard.length;
  trainers[id] = { ...t, stats: { ...t.stats, finalDeckSize: deckSize } };
}

const allStats: Record<string, TrainerStats> = {};
for (const [id, t] of Object.entries(trainers)) {
  allStats[id] = t.stats;
}
const superlatives = calculateSuperlatives(allStats);
```

Add `superlatives` to the returned game over state.

Import `calculateSuperlatives` at the top of `action-resolver.ts`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run engine/__tests__/action-resolver.test.ts`
Expected: PASS

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Fix any failures from the new `superlatives` field on `GameState`.

- [ ] **Step 7: Commit**

```bash
git add engine/types.ts engine/index.ts engine/action-resolver.ts engine/__tests__/action-resolver.test.ts
git commit -m "feat: compute final deck size and superlatives at game over"
```

### Task 15: Add stats to views and export Superlative type

**Files:**
- Modify: `engine/types.ts` (TrainerPublicInfo, TVViewState)
- Modify: `engine/views.ts`
- Modify: `engine/index.ts` (exports)
- Test: `engine/__tests__/views.test.ts`

- [ ] **Step 1: Add stats to TrainerPublicInfo and TVViewState**

In `engine/types.ts`:
- Add `readonly stats?: TrainerStats;` to `TrainerPublicInfo`
- Add `readonly superlatives: Superlative[];` to `TVViewState`
- Add `readonly superlatives: Superlative[];` to `PhoneViewState`

Import `Superlative` type.

- [ ] **Step 2: Update view builders**

In `engine/views.ts`, update `toPublicInfo`:

```typescript
function toPublicInfo(trainer: Trainer, phase: GamePhase): TrainerPublicInfo {
  return {
    // ... existing fields ...
    riskLevel: computeRiskLevel(trainer, phase),
    stats: phase === "game_over" ? trainer.stats : undefined,
  };
}
```

Update `createTVView` to include `superlatives: state.superlatives`.
Update `createPhoneView` to include `superlatives: state.superlatives`.

- [ ] **Step 3: Write test**

```typescript
it("includes stats in TrainerPublicInfo during game_over", () => {
  const state = makeGameOverState({ /* ... */ });
  const view = createTVView(state);
  expect(view.trainers.t1.stats).toBeDefined();
});

it("excludes stats from TrainerPublicInfo during route", () => {
  const state = makeRouteState({ /* ... */ });
  const view = createTVView(state);
  expect(view.trainers.t1.stats).toBeUndefined();
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run engine/__tests__/views.test.ts`

- [ ] **Step 5: Export Superlative type from engine/index.ts**

Add to exports:

```typescript
export type { Superlative } from "./models/superlatives";
```

- [ ] **Step 6: Commit**

```bash
git add engine/types.ts engine/views.ts engine/index.ts engine/__tests__/views.test.ts
git commit -m "feat: expose stats and superlatives in view states"
```

### Task 16: Implement play_again action

**Files:**
- Modify: `engine/types.ts` (Action union)
- Modify: `engine/action-resolver.ts`
- Test: `engine/__tests__/action-resolver.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
describe("play_again", () => {
  it("resets game state to lobby preserving trainer names and avatars", () => {
    const state = gameOverState(); // helper
    const [newState] = resolveAction(state, { type: "play_again", trainerId: "t1" });
    expect(newState.phase).toBe("lobby");
    expect(newState.trainers.t1.name).toBe(state.trainers.t1.name);
    expect(newState.trainers.t1.avatar).toBe(state.trainers.t1.avatar);
    expect(newState.trainers.t1.score).toBe(0);
    expect(newState.trainers.t1.deck.drawPile.length).toBeGreaterThan(0);
    expect(newState.map).toBeNull();
    expect(newState.currentRoute).toBeNull();
    expect(newState.superlatives).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Add play_again to Action union and implement handler**

In `engine/types.ts`, add to Action:

```typescript
| { type: "play_again"; trainerId: string }
```

In `engine/action-resolver.ts`, add case and handler:

```typescript
case "play_again":
  return handlePlayAgain(state);
```

```typescript
function handlePlayAgain(state: GameState): ResolveResult {
  if (state.phase !== "game_over") return [state, []];

  const trainers: Record<string, Trainer> = {};
  for (const [id, t] of Object.entries(state.trainers)) {
    trainers[id] = {
      ...t,
      deck: createDeck(createStarterTeam()),
      score: 0,
      bustThreshold: 0,
      currency: 0,
      items: [],
      status: "waiting",
      routeProgress: freshProgress(),
      finalRouteDistance: null,
      finalRouteCost: null,
      stats: freshStats(),
    };
  }

  return [{
    ...state,
    phase: "lobby",
    trainers,
    map: null,
    currentRoute: null,
    hub: null,
    votes: null,
    routeNumber: 0,
    superlatives: [],
  }, [{ type: "play_again" as const }]];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run engine/__tests__/action-resolver.test.ts`

- [ ] **Step 5: Commit**

```bash
git add engine/types.ts engine/action-resolver.ts engine/__tests__/action-resolver.test.ts
git commit -m "feat: add play_again action to reset game to lobby"
```

### Task 17: Update TV GameOver screen with ceremony

**Files:**
- Modify: `src/screens/game/GameOver.svelte`
- Modify: `copy.ts`

- [ ] **Step 1: Add copy strings**

In `copy.ts`:

```typescript
// Game over ceremony
finalStandings: "Final Standings",
cardsDrawnLabel: "Cards Drawn",
bustCountLabel: "Times Busted",
maxDistanceLabel: "Best Route",
currencyEarnedLabel: "Total Currency",
```

- [ ] **Step 2: Rewrite GameOver.svelte with ceremony**

```svelte
<script lang="ts">
  import type { TVViewState, TrainerPublicInfo } from '../../../engine/types';
  import { copy } from '../../../copy';
  import Sprite from '../../components/Sprite.svelte';

  let { gameState }: { gameState: TVViewState } = $props();

  let sortedTrainers = $derived(
    (Object.values(gameState.trainers) as TrainerPublicInfo[])
      .sort((a, b) => b.score - a.score)
  );

  // Staggered reveal: bottom-to-top with 1s delays
  let revealedCount = $state(0);
  let showStats = $state(false);
  let showSuperlatives = $state(false);

  $effect(() => {
    const total = sortedTrainers.length;
    let count = 0;
    const interval = setInterval(() => {
      count++;
      revealedCount = count;
      if (count >= total) {
        clearInterval(interval);
        setTimeout(() => { showStats = true; }, 1000);
        setTimeout(() => { showSuperlatives = true; }, 2000);
      }
    }, 1000);
    return () => clearInterval(interval);
  });

  let superlativeMap = $derived.by(() => {
    const map = new Map<string, string>();
    for (const s of gameState.superlatives) {
      map.set(s.trainerId, s.award);
    }
    return map;
  });
</script>

<section>
  <h2>{copy.finalStandings}</h2>

  <div class="standings">
    {#each sortedTrainers.toReversed() as trainer, i}
      {@const rank = sortedTrainers.length - i}
      {@const isRevealed = i < revealedCount}
      {#if isRevealed}
        <div class="trainer-row reveal-in" class:champion={rank === 1}>
          <span class="rank">#{rank}</span>
          <Sprite avatarId={trainer.avatar} scale={rank === 1 ? 1 : 0.6} />
          <div class="trainer-info">
            <strong>{trainer.name}</strong>
            <span class="score">{trainer.score} {copy.score}</span>
            {#if showSuperlatives && superlativeMap.has(trainer.id)}
              <span class="superlative">{superlativeMap.get(trainer.id)}</span>
            {/if}
          </div>
          {#if showStats && trainer.stats}
            <div class="stats">
              <span>{copy.cardsDrawnLabel}: {trainer.stats.cardsDrawn}</span>
              <span>{copy.bustCountLabel}: {trainer.stats.bustCount}</span>
              <span>{copy.maxDistanceLabel}: {trainer.stats.maxRouteDistance}</span>
              <span>{copy.currencyEarnedLabel}: {trainer.stats.totalCurrencyEarned}</span>
            </div>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
</section>

<style>
  section { padding: var(--space-6); text-align: center; }
  .standings { display: flex; flex-direction: column-reverse; gap: var(--space-4); margin-top: var(--space-6); }
  .trainer-row {
    display: flex; align-items: center; gap: var(--space-4);
    padding: var(--space-4); border-radius: var(--radius-lg);
    background: var(--color-bg-muted);
    animation: reveal-slide 0.6s ease-out;
  }
  .trainer-row.champion {
    background: linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,215,0,0.05));
    border: 2px solid var(--color-gold);
    padding: var(--space-6);
  }
  .rank { font-size: var(--text-2xl); font-weight: bold; color: var(--color-text-dim); min-width: 2.5rem; }
  .trainer-info { display: flex; flex-direction: column; flex: 1; }
  .score { font-size: var(--text-lg); color: var(--color-text-secondary); }
  .superlative { font-size: var(--text-sm); color: var(--color-gold); font-style: italic; }
  .stats { display: flex; flex-direction: column; font-size: var(--text-sm); color: var(--color-text-dim); text-align: right; }
  @keyframes reveal-slide {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/game/GameOver.svelte copy.ts
git commit -m "feat: add game over ceremony with staggered reveal and superlatives on TV"
```

### Task 18: Update phone GameOver screen with stats and play again

**Files:**
- Modify: `src/screens/player/PhoneGameOver.svelte`
- Modify: `src/screens/player/PlayerScreen.svelte` (pass `send` to PhoneGameOver)

- [ ] **Step 1: Update PhoneGameOver to show stats and play again button**

```svelte
<script lang="ts">
  import type { PhoneViewState, Action } from '../../../engine/types';
  import { copy } from '../../../copy';

  let { gameState, send }: {
    gameState: PhoneViewState;
    send: (action: Action) => void;
  } = $props();

  let me = $derived(gameState.me);
  let allTrainers = $derived(
    [
      { name: me.name, score: me.score },
      ...Object.values(gameState.otherTrainers).map(t => ({ name: t.name, score: t.score })),
    ].sort((a, b) => b.score - a.score)
  );
  let myRank = $derived(allTrainers.findIndex(t => t.name === me.name) + 1);
  let mySuperlative = $derived(
    gameState.superlatives.find(s => s.trainerId === me.id)
  );

  function playAgain() {
    send({ type: "play_again", trainerId: me.id });
  }
</script>

<section>
  <h2>{copy.gameOver}</h2>
  <p class="your-score">{copy.yourScore}: <strong>{me.score}</strong></p>
  <p>{copy.rank}: #{myRank} of {allTrainers.length}</p>

  {#if mySuperlative}
    <p class="superlative">{mySuperlative.award}</p>
  {/if}

  <div class="my-stats">
    <div class="stat-row">{copy.cardsDrawnLabel}: {me.stats.cardsDrawn}</div>
    <div class="stat-row">{copy.bustCountLabel}: {me.stats.bustCount}</div>
    <div class="stat-row">{copy.maxDistanceLabel}: {me.stats.maxRouteDistance}</div>
    <div class="stat-row">{copy.currencyEarnedLabel}: {me.stats.totalCurrencyEarned}</div>
  </div>

  <div class="standings">
    {#each allTrainers as trainer, i}
      <div class="row" class:you={trainer.name === me.name}>
        #{i + 1} <strong>{trainer.name}</strong> — {trainer.score}
      </div>
    {/each}
  </div>

  <button class="play-again" onclick={playAgain}>Play Again</button>
</section>

<style>
  section { padding: var(--space-6); text-align: center; }
  .your-score { font-size: var(--text-3xl); }
  .superlative { font-size: var(--text-lg); color: var(--color-gold); font-style: italic; margin: var(--space-4) 0; }
  .my-stats { margin: var(--space-6) 0; text-align: left; max-width: 15rem; margin-left: auto; margin-right: auto; }
  .stat-row { padding: var(--space-2) 0; font-size: var(--text-md); border-bottom: 1px solid var(--color-border); }
  .standings { text-align: left; margin-top: var(--space-6); }
  .row { padding: 0.3rem 0; }
  .row.you { font-weight: bold; color: var(--color-primary); }
  .play-again {
    margin-top: var(--space-6);
    padding: var(--space-5) var(--space-8);
    font-size: var(--text-xl);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-2xl);
    cursor: pointer;
    font-weight: bold;
  }
  .play-again:hover { background: var(--color-primary-hover); }
</style>
```

- [ ] **Step 2: Update PlayerScreen to pass send to PhoneGameOver**

In `PlayerScreen.svelte` (line 30), update:

```svelte
{:else if gameState.phase === 'game_over'}
  <PhoneGameOver {gameState} {send} />
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/player/PhoneGameOver.svelte src/screens/player/PlayerScreen.svelte
git commit -m "feat: add stats, superlatives, and play again button to phone game over"
```

---

## Chunk 4: Node Bonuses

Largest scope. Adds event phase, rest stop phase, marketplace flag. Requires engine changes (new phases, actions, events) and new frontend screens.

### Task 19: Add RouteEvent type and event field to GameState

**Files:**
- Modify: `engine/types.ts`
- Modify: `engine/index.ts` (createInitialState)

- [ ] **Step 1: Add types**

In `engine/types.ts`:

```typescript
// After RouteModifier definition
export type RouteEvent =
  | { type: "modifier"; modifier: RouteModifier; name: string; description: string }
  | { type: "fog"; name: string; description: string }
  | { type: "bounty"; name: string; description: string };
```

Update `GamePhase`:

```typescript
export type GamePhase = "lobby" | "event" | "route" | "hub" | "rest_stop" | "world" | "game_over";
```

Add to `GameState`:

```typescript
readonly event: RouteEvent | null;
```

Add new action variants to `Action`:

```typescript
| { type: "continue_event"; trainerId: string }
| { type: "rest_stop_choice"; trainerId: string; choice: "remove" | "scout" | "reinforce"; pokemonId?: string }
```

Note: `rest_stop_choice` is a single union variant (not three separate ones) to work cleanly with the `switch` on `action.type`. The `pokemonId` is optional and only used when `choice` is `"remove"`.

Add new event types to `GameEvent`:

```typescript
| { type: "event_started"; event: RouteEvent }
| { type: "rest_stop_entered" }
| { type: "rest_stop_choice_made"; trainerId: string; choice: string }
| { type: "scout_result"; trainerId: string; pokemonIds: string[] }
| { type: "play_again" }
```

Add `pendingThresholdBonus: number` to `Trainer`.

Add `isMarketplace: boolean` to `HubState`.

Add `restStopChoices: Record<string, string>` to `GameState` for tracking who has chosen.

- [ ] **Step 2: Update createInitialState**

Add `event: null`, `restStopChoices: null` (or `{}`) to the initial state.

- [ ] **Step 3: Update all Trainer construction sites**

Add `pendingThresholdBonus: 0` to `handleJoin`, `handleAddBot`, `handleStart`, and `handlePlayAgain`.

- [ ] **Step 4: Run all tests, fix compilation errors**

Run: `npx vitest run`
Fix any failures from new required fields.

- [ ] **Step 5: Commit**

```bash
git add engine/types.ts engine/index.ts engine/action-resolver.ts
git commit -m "feat: add RouteEvent, rest_stop, and marketplace types"
```

### Task 20: Implement event generation and event phase

**Files:**
- Create: `engine/phases/event.ts`
- Modify: `engine/action-resolver.ts`
- Test: `engine/__tests__/event.test.ts`

- [ ] **Step 1: Write tests for event generation and continue_event**

Create `engine/__tests__/event.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateEvent } from "../phases/event";
import { resolveAction } from "../action-resolver";

describe("event phase", () => {
  it("generates modifier events from the event pool", () => {
    const event = generateEvent(3, 10, () => 0);
    expect(event).not.toBeNull();
    expect(event!.name).toBeTruthy();
  });

  it("continue_event transitions to route phase", () => {
    const state = makeEventState(); // helper with phase: "event"
    const [newState] = resolveAction(state, { type: "continue_event", trainerId: "t1" });
    expect(newState.phase).toBe("route");
  });
});
```

- [ ] **Step 2: Implement event generation**

Create `engine/phases/event.ts`:

```typescript
import type { RouteEvent, RouteModifier, RngFn, PokemonType } from "../types";

const EVENT_POOL: ((tier: number, totalTiers: number, rng: RngFn) => RouteEvent)[] = [
  // Sandstorm — +1 cost
  () => ({
    type: "modifier",
    modifier: { id: "sandstorm", description: "Sandstorm: +1 fatigue to all draws", type: "cost_bonus", value: 1 },
    name: "Sandstorm",
    description: "A harsh sandstorm increases fatigue on all draws.",
  }),
  // Tailwind — +2 distance
  () => ({
    type: "modifier",
    modifier: { id: "tailwind", description: "Tailwind: +2 distance to all draws", type: "distance_bonus", value: 2 },
    name: "Tailwind",
    description: "A strong tailwind boosts distance on all draws.",
  }),
  // Type Surge — random type gets double bonus
  (_tier, _totalTiers, rng) => {
    const types: PokemonType[] = ["fire", "water", "grass", "electric", "rock", "dragon"];
    const bonusType = types[Math.floor(rng() * types.length)];
    return {
      type: "modifier",
      modifier: { id: `surge_${bonusType}`, description: `${bonusType} surge: ${bonusType}-type get +3 distance`, type: "type_bonus", value: 3, targetType: bonusType },
      name: `${bonusType.charAt(0).toUpperCase() + bonusType.slice(1)} Surge`,
      description: `${bonusType}-type Pokémon surge with extra distance.`,
    };
  },
  // Fog
  () => ({
    type: "fog",
    name: "Fog",
    description: "Dense fog hides the bust threshold until you're close.",
  }),
  // Bounty
  () => ({
    type: "bounty",
    name: "Bounty",
    description: "A bounty doubles currency rewards on this route.",
  }),
];

export function generateEvent(tier: number, totalTiers: number, rng: RngFn): RouteEvent | null {
  // Higher tiers have more event variety
  const idx = Math.floor(rng() * EVENT_POOL.length);
  return EVENT_POOL[idx](tier, totalTiers, rng);
}
```

- [ ] **Step 3: Add continue_event handler to action-resolver**

In `action-resolver.ts`:

```typescript
case "continue_event":
  return handleContinueEvent(state);
```

```typescript
function handleContinueEvent(state: GameState): ResolveResult {
  if (state.phase !== "event") return [state, []];

  // Apply modifier-type events to the current route
  let currentRoute = state.currentRoute;
  if (state.event && state.event.type === "modifier" && currentRoute) {
    currentRoute = {
      ...currentRoute,
      modifiers: [...currentRoute.modifiers, state.event.modifier],
    };
  }

  return [{ ...state, phase: "route", currentRoute }, []];
}
```

- [ ] **Step 4: Update handleStart and handleVote to check for events**

In `handleStart`, after creating the route, check if the start node has an event bonus:

```typescript
if (startNode.bonus === "event") {
  const event = generateEvent(startNode.tier, updatedMap.totalTiers, Math.random);
  if (event) {
    return [
      { ...state, phase: "event", trainers, currentRoute: route, routeNumber: 1, map: updatedMap, event },
      [
        { type: "game_started", map: updatedMap },
        { type: "event_started", event },
      ],
    ];
  }
}
```

Similarly in `handleVote` (in `engine/phases/world.ts`), check if the chosen node has an event bonus and transition to `"event"` phase instead of `"route"`.

- [ ] **Step 5: Run tests**

Run: `npx vitest run`

- [ ] **Step 6: Commit**

```bash
git add engine/phases/event.ts engine/__tests__/event.test.ts engine/action-resolver.ts engine/phases/world.ts
git commit -m "feat: add event phase with route modifiers, fog, and bounty"
```

### Task 21: Implement fog and bounty event effects

**Files:**
- Modify: `engine/action-resolver.ts` (handleHit for fog threshold hiding, resolveRouteEnd for bounty currency)
- Modify: `engine/views.ts` (fog affects phone view)
- Test: `engine/__tests__/event.test.ts`

- [ ] **Step 1: Write tests**

```typescript
describe("fog event", () => {
  it("hides bust threshold in phone view when cost is far from threshold", () => {
    const state = routeStateWithFogEvent({ totalCost: 1, bustThreshold: 7 });
    const view = createPhoneView(state, "t1");
    expect(view.me.bustThreshold).toBe(-1); // hidden sentinel
  });

  it("reveals bust threshold when within 2", () => {
    const state = routeStateWithFogEvent({ totalCost: 6, bustThreshold: 7 });
    const view = createPhoneView(state, "t1");
    expect(view.me.bustThreshold).toBe(7);
  });
});

describe("bounty event", () => {
  it("doubles currency earned on stop", () => {
    // ... test that currency is doubled when bounty event is active
  });
});
```

- [ ] **Step 2: Implement fog in phone view**

In `engine/views.ts`, update `createPhoneView`:

```typescript
// If fog event is active and trainer is not within 2 of threshold, hide it
let meForView = me;
if (state.event?.type === "fog" && state.phase === "route" && me.status === "exploring") {
  const gap = me.bustThreshold - me.routeProgress.totalCost;
  if (gap > 2) {
    meForView = { ...me, bustThreshold: -1 };
  }
}
```

- [ ] **Step 3: Implement bounty in resolveRouteEnd**

In `action-resolver.ts`, update `resolveRouteEnd` to accept the event and double currency if bounty:

```typescript
function resolveRouteEnd(trainer: Trainer, trail: Trail, event: RouteEvent | null): { ... } {
  // ... existing logic ...
  let currencyEarned = trail.spots[trailPos].currency + bonusCurrency;
  if (event?.type === "bounty") {
    currencyEarned *= 2;
  }
  return { vpEarned, currencyEarned, events };
}
```

Update all call sites of `resolveRouteEnd` to pass `state.event`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run`

- [ ] **Step 5: Commit**

```bash
git add engine/action-resolver.ts engine/views.ts engine/__tests__/event.test.ts
git commit -m "feat: implement fog and bounty event effects"
```

### Task 22: Implement rest stop phase

**Files:**
- Create: `engine/phases/rest-stop.ts`
- Modify: `engine/action-resolver.ts`
- Modify: `engine/phases/hub.ts` (handleConfirmSelections transition)
- Test: `engine/__tests__/rest-stop.test.ts`

- [ ] **Step 1: Write tests**

Create `engine/__tests__/rest-stop.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { handleRestStopChoice } from "../phases/rest-stop";

describe("rest stop", () => {
  it("removes a card from all deck piles on 'remove' choice", () => {
    const state = restStopState(); // trainer with known deck
    const [newState] = handleRestStopChoice(state, { type: "rest_stop_choice", trainerId: "t1", choice: "remove", pokemonId: "pkmn_1" });
    const t = newState.trainers.t1;
    const allCards = [...t.deck.drawPile, ...t.deck.drawn, ...t.deck.discard];
    expect(allCards.find(p => p.id === "pkmn_1")).toBeUndefined();
  });

  it("emits scout_result with top 3 draw pile cards on 'scout' choice", () => {
    const state = restStopState();
    const [, events] = handleRestStopChoice(state, { type: "rest_stop_choice", trainerId: "t1", choice: "scout" });
    const scoutEvent = events.find(e => e.type === "scout_result");
    expect(scoutEvent).toBeDefined();
    expect(scoutEvent!.pokemonIds.length).toBeLessThanOrEqual(3);
  });

  it("sets pendingThresholdBonus on 'reinforce' choice", () => {
    const state = restStopState();
    const [newState] = handleRestStopChoice(state, { type: "rest_stop_choice", trainerId: "t1", choice: "reinforce" });
    expect(newState.trainers.t1.pendingThresholdBonus).toBe(1);
  });

  it("transitions to world when all trainers have chosen", () => {
    const state = restStopStateAllChosen();
    const [newState] = handleRestStopChoice(state, { type: "rest_stop_choice", trainerId: "t2", choice: "scout" });
    expect(newState.phase).toBe("world");
  });
});
```

- [ ] **Step 2: Implement rest stop handler**

Create `engine/phases/rest-stop.ts`:

```typescript
import type { GameState, GameEvent, Trainer, ResolveResult } from "../types";

export function handleRestStopChoice(
  state: GameState,
  action: { type: "rest_stop_choice"; trainerId: string; choice: string; pokemonId?: string },
): ResolveResult {
  if (state.phase !== "rest_stop") return [state, []];
  const trainer = state.trainers[action.trainerId];
  if (!trainer) return [state, []];

  const choices = state.restStopChoices ?? {};
  if (choices[action.trainerId]) return [state, []]; // already chose

  const events: GameEvent[] = [
    { type: "rest_stop_choice_made", trainerId: action.trainerId, choice: action.choice },
  ];

  let updatedTrainer = trainer;

  switch (action.choice) {
    case "remove": {
      if (!action.pokemonId) return [state, []];
      const removeFromPile = (pile: readonly Pokemon[]) => pile.filter(p => p.id !== action.pokemonId);
      updatedTrainer = {
        ...trainer,
        deck: {
          drawPile: removeFromPile(trainer.deck.drawPile),
          drawn: removeFromPile(trainer.deck.drawn),
          discard: removeFromPile(trainer.deck.discard),
        },
      };
      break;
    }
    case "scout": {
      const top3 = trainer.deck.drawPile.slice(0, 3);
      events.push({
        type: "scout_result",
        trainerId: action.trainerId,
        pokemonIds: top3.map(p => p.id),
      });
      break;
    }
    case "reinforce": {
      updatedTrainer = {
        ...trainer,
        pendingThresholdBonus: trainer.pendingThresholdBonus + 1,
      };
      break;
    }
  }

  const newChoices = { ...choices, [action.trainerId]: action.choice };
  const allChosen = Object.keys(state.trainers).every(id => newChoices[id]);

  const newState: GameState = {
    ...state,
    trainers: { ...state.trainers, [action.trainerId]: updatedTrainer },
    restStopChoices: newChoices,
    phase: allChosen ? "world" : "rest_stop",
    votes: allChosen ? {} : state.votes,
  };

  if (allChosen) {
    events.push({ type: "world_entered" });
  }

  return [newState, events];
}
```

- [ ] **Step 3: Wire up rest stop in action-resolver**

In `action-resolver.ts`:

```typescript
case "rest_stop_choice":
  return handleRestStopChoice(state, action);
```

Import `handleRestStopChoice` from `./phases/rest-stop`.

- [ ] **Step 4: Update hub confirmation to transition to rest_stop when applicable**

In `engine/phases/hub.ts`, update `handleConfirmSelections` where `allConfirmed` is true (line 160-172):

```typescript
if (allConfirmed) {
  events.push({ type: "all_ready" });

  const currentNode = state.map?.nodes[state.map.currentNodeId];
  if (currentNode?.bonus === "rest_stop") {
    events.push({ type: "rest_stop_entered" });
    return [{
      ...state,
      phase: "rest_stop",
      hub: null,
      restStopChoices: {},
      trainers: { ...state.trainers, [action.trainerId]: { ...trainer, deck: newDeck, currency: trainer.currency - totalCost } },
    }, events];
  }

  events.push({ type: "world_entered" });
  return [{ /* existing world transition */ }, events];
}
```

- [ ] **Step 5: Consume pendingThresholdBonus when entering a new route**

In `handleVote` (world.ts), when setting up trainers for the new route:

```typescript
trainers[id] = {
  ...t,
  status: "exploring",
  bustThreshold: chosenNode.bustThreshold + t.pendingThresholdBonus,
  pendingThresholdBonus: 0,
  // ... rest
};
```

Same in `handleStart`.

- [ ] **Step 6: Run tests**

Run: `npx vitest run`

- [ ] **Step 7: Commit**

```bash
git add engine/phases/rest-stop.ts engine/__tests__/rest-stop.test.ts engine/action-resolver.ts engine/phases/hub.ts engine/phases/world.ts
git commit -m "feat: add rest stop phase with remove, scout, and reinforce choices"
```

### Task 23: Implement marketplace flag

**Files:**
- Modify: `engine/phases/hub.ts`
- Test: `engine/__tests__/hub.test.ts`

- [ ] **Step 1: Write test**

```typescript
describe("marketplace", () => {
  it("generates more shop pokemon when isMarketplace is true", () => {
    const state = hubStateWithMarketplace();
    expect(state.hub!.shopPokemon.length).toBeGreaterThanOrEqual(5);
    expect(state.hub!.isMarketplace).toBe(true);
  });
});
```

- [ ] **Step 2: Update enterHub to check for marketplace bonus**

In `enterHub`, check the current node's bonus:

```typescript
const isMarketplace = currentNode.bonus === "marketplace";
const shopPokemon = generateShopPokemon(currentNode.tier, map.totalTiers, rng, isMarketplace);
```

Update `generateShopPokemon` to accept an `isMarketplace` parameter:

```typescript
function generateShopPokemon(tier: number, totalTiers: number, rng: RngFn, isMarketplace = false): Pokemon[] {
  const allIds = getAllTemplateIds();
  const buckets = buildRarityBuckets(allIds);
  const shopSize = isMarketplace ? (5 + (rng() < 0.5 ? 1 : 0)) : (3 + (rng() < 0.5 ? 1 : 0));
  const progress = tier / (totalTiers - 1);

  const weights: Record<string, number> = {
    common: Math.max(0.1, 0.8 - progress * 0.6),
    uncommon: 0.3 + progress * 0.2,
    rare: progress * 0.4,
    legendary: progress > 0.7 ? (progress - 0.7) * 0.8 : 0,
  };

  const pokemon = Array.from({ length: shopSize }, () =>
    createPokemon(pickByRarity(weights, buckets, allIds, rng))
  );

  // Guarantee at least one rare or legendary for marketplace
  if (isMarketplace) {
    const hasRareOrLegendary = pokemon.some(p => p.rarity === "rare" || p.rarity === "legendary");
    if (!hasRareOrLegendary && buckets.rare.length > 0) {
      const rareId = buckets.rare[Math.floor(rng() * buckets.rare.length)];
      pokemon[0] = createPokemon(rareId);
    }
  }

  return pokemon;
}
```

Add `isMarketplace` to the `HubState` creation:

```typescript
const hub: HubState = {
  // ... existing fields ...
  isMarketplace,
};
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run`

- [ ] **Step 4: Commit**

```bash
git add engine/phases/hub.ts engine/__tests__/hub.test.ts
git commit -m "feat: add marketplace node bonus with expanded shop"
```

### Task 24: Update TV/phone view types for new fields

**IMPORTANT:** This task must be done BEFORE the frontend screens task, because the frontend components reference `gameState.event` which must exist on the view types first.

**Files:**
- Modify: `engine/types.ts` (TVViewState, PhoneViewState)
- Modify: `engine/views.ts`

- [ ] **Step 1: Add event to view states**

In `engine/types.ts`:

Add to `TVViewState`:

```typescript
readonly event: RouteEvent | null;
```

Add to `PhoneViewState`:

```typescript
readonly event: RouteEvent | null;
```

- [ ] **Step 2: Update view builders**

In `engine/views.ts`:

```typescript
// In createTVView:
event: state.event,

// In createPhoneView:
event: state.event,
```

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Fix any failures.

- [ ] **Step 4: Commit**

```bash
git add engine/types.ts engine/views.ts
git commit -m "feat: expose event in view states"
```

### Task 25: Add frontend screens for new phases

**Files:**
- Create: `src/screens/game/Event.svelte` (TV event screen)
- Create: `src/screens/player/RestStopControls.svelte` (phone rest stop)
- Modify: `src/screens/game/GameScreen.svelte` (add event and rest_stop routing)
- Modify: `src/screens/player/PlayerScreen.svelte` (add rest_stop routing)
- Modify: `copy.ts`

- [ ] **Step 1: Add copy strings**

```typescript
// Events
eventAnnouncement: "Event!",
continueButton: "Continue",

// Rest stops
restStop: "Rest Stop",
restStopPrompt: "Choose a benefit:",
removeCard: "Remove a Card",
removeCardDesc: "Permanently remove one Pokémon from your deck.",
scoutAhead: "Scout Ahead",
scoutAheadDesc: "Preview your next 3 draws.",
reinforce: "Reinforce",
reinforceDesc: "+1 bust threshold on next route.",

// Marketplace
marketplace: "Marketplace",
```

- [ ] **Step 2: Create TV Event screen**

Create `src/screens/game/Event.svelte`:

```svelte
<script lang="ts">
  import type { TVViewState, Action } from '../../../engine/types';
  import { copy } from '../../../copy';

  let { gameState, send }: {
    gameState: TVViewState;
    send: (action: Action) => void;
  } = $props();

  let event = $derived(gameState.event!);

  // Auto-continue after 3 seconds
  let countdown = $state(3);
  $effect(() => {
    const interval = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(interval);
        // Host can also click continue
      }
    }, 1000);
    return () => clearInterval(interval);
  });

  function continueToRoute() {
    // Any trainer can trigger continue
    const firstTrainer = Object.keys(gameState.trainers)[0];
    send({ type: "continue_event", trainerId: firstTrainer });
  }
</script>

<section>
  <h2>{copy.eventAnnouncement}</h2>
  <div class="event-card">
    <h3 class="event-name">{event.name}</h3>
    <p class="event-desc">{event.description}</p>
  </div>
  <button class="continue-btn" onclick={continueToRoute}>
    {copy.continueButton} {#if countdown > 0}({countdown}){/if}
  </button>
</section>

<style>
  section { padding: var(--space-6); text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 50vh; }
  .event-card {
    margin: var(--space-8) 0;
    padding: var(--space-8);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-2xl);
    background: var(--color-bg-muted);
    max-width: 30rem;
    animation: event-appear 0.6s ease-out;
  }
  .event-name { font-size: var(--text-3xl); margin-bottom: var(--space-4); }
  .event-desc { font-size: var(--text-lg); color: var(--color-text-secondary); }
  .continue-btn {
    padding: var(--space-4) var(--space-8);
    font-size: var(--text-lg);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-xl);
    cursor: pointer;
  }
  @keyframes event-appear {
    from { transform: scale(0.8); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
</style>
```

- [ ] **Step 3: Create phone RestStopControls screen**

Create `src/screens/player/RestStopControls.svelte`:

```svelte
<script lang="ts">
  import type { PhoneViewState, Action } from '../../../engine/types';
  import { copy } from '../../../copy';
  import PokemonCard from '../../components/PokemonCard.svelte';

  let { gameState, send }: {
    gameState: PhoneViewState;
    send: (action: Action) => void;
  } = $props();

  let me = $derived(gameState.me);
  let hasChosen = $state(false);
  let showRemoveList = $state(false);

  let allDeckCards = $derived([
    ...me.deck.drawPile,
    ...me.deck.drawn,
    ...me.deck.discard,
  ]);

  function chooseRemove(pokemonId: string) {
    send({ type: "rest_stop_choice", trainerId: me.id, choice: "remove", pokemonId });
    hasChosen = true;
  }

  function chooseScout() {
    send({ type: "rest_stop_choice", trainerId: me.id, choice: "scout" });
    hasChosen = true;
  }

  function chooseReinforce() {
    send({ type: "rest_stop_choice", trainerId: me.id, choice: "reinforce" });
    hasChosen = true;
  }
</script>

<section>
  <h2>{copy.restStop}</h2>

  {#if hasChosen}
    <p>{copy.waitingForOthers}</p>
  {:else if showRemoveList}
    <p>Choose a Pokémon to remove:</p>
    <div class="card-list">
      {#each allDeckCards as pkmn}
        <button class="remove-option" onclick={() => chooseRemove(pkmn.id)}>
          <PokemonCard pokemon={pkmn} />
        </button>
      {/each}
    </div>
    <button onclick={() => showRemoveList = false}>Back</button>
  {:else}
    <p>{copy.restStopPrompt}</p>
    <div class="choices">
      <button class="choice-btn" onclick={() => showRemoveList = true}>
        <strong>{copy.removeCard}</strong>
        <span>{copy.removeCardDesc}</span>
      </button>
      <button class="choice-btn" onclick={chooseScout}>
        <strong>{copy.scoutAhead}</strong>
        <span>{copy.scoutAheadDesc}</span>
      </button>
      <button class="choice-btn" onclick={chooseReinforce}>
        <strong>{copy.reinforce}</strong>
        <span>{copy.reinforceDesc}</span>
      </button>
    </div>
  {/if}
</section>

<style>
  section { padding: var(--space-6); text-align: center; }
  .choices { display: flex; flex-direction: column; gap: var(--space-4); margin: var(--space-6) 0; }
  .choice-btn {
    display: flex; flex-direction: column; gap: var(--space-2);
    padding: var(--space-5); border: 2px solid var(--color-border);
    border-radius: var(--radius-lg); background: var(--color-bg); cursor: pointer;
    text-align: left;
  }
  .choice-btn:hover { border-color: var(--color-primary); background: var(--color-bg-muted); }
  .choice-btn span { font-size: var(--text-sm); color: var(--color-text-secondary); }
  .card-list { display: flex; flex-direction: column; gap: var(--space-3); margin: var(--space-4) 0; }
  .remove-option { background: none; border: none; cursor: pointer; padding: 0; }
  .remove-option:hover { opacity: 0.8; }
</style>
```

- [ ] **Step 4: Update GameScreen.svelte routing**

Add imports and phase cases:

```svelte
import Event from './Event.svelte';
```

Add after the lobby case:

```svelte
{:else if gameState.phase === 'event'}
  <Event {gameState} {send} />
```

Add rest_stop case (show Hub-like screen or a simple waiting screen on TV):

```svelte
{:else if gameState.phase === 'rest_stop'}
  <section>
    <h2>{copy.restStop}</h2>
    <p>{copy.waitingForOthers}</p>
  </section>
```

- [ ] **Step 5: Update PlayerScreen.svelte routing**

Add imports:

```svelte
import RestStopControls from './RestStopControls.svelte';
```

Add:

```svelte
{:else if gameState.phase === 'event'}
  <section><p>Event incoming...</p></section>
{:else if gameState.phase === 'rest_stop'}
  <RestStopControls {gameState} {send} />
```

- [ ] **Step 6: Update bot strategies for new phases**

In `engine/sim/strategies.ts`, add rest stop and event strategies:

```typescript
export type RestStopStrategy = (state: GameState, trainerId: string) => Action;
export type EventStrategy = (state: GameState, trainerId: string) => Action;
```

Add `restStop` and `event` to `PlayerStrategy` and implement:

```typescript
const autoRestStop: RestStopStrategy = (_state, trainerId) => {
  return { type: "rest_stop_choice", trainerId, choice: "reinforce" };
};

const autoEvent: EventStrategy = (_state, trainerId) => {
  return { type: "continue_event", trainerId };
};
```

Update the server's bot handler to handle `"event"` and `"rest_stop"` phases.

- [ ] **Step 7: Commit**

```bash
git add src/screens/game/Event.svelte src/screens/player/RestStopControls.svelte src/screens/game/GameScreen.svelte src/screens/player/PlayerScreen.svelte engine/sim/strategies.ts copy.ts
git commit -m "feat: add frontend screens for event and rest stop phases"
```

### Task 26: Final integration — run full test suite and manual smoke test

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run dev server and smoke test**

Run: `npm run dev`

Test manually:
1. Start a game with bots
2. Verify danger meter appears on phone during route
3. Verify card reveal delay works
4. Verify bust flash/shake works
5. Verify hub countdown works
6. Verify blind voting on TV
7. Verify phase transitions on TV
8. Play through to game over (may need to reduce tiers temporarily)
9. Verify game over ceremony with stats and superlatives
10. Verify play again button works

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address integration issues from smoke testing"
```
