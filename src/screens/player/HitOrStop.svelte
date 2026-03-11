<script lang="ts">
  import type { PhoneViewState, Action } from '../../../engine/types';
  import { getTrailPosition } from '../../../engine/models/trail';
  import { copy } from '../../../copy';
  import PokemonCard from '../../components/PokemonCard.svelte';
  import TrailSpot from '../../components/TrailSpot.svelte';

  let { gameState, send }: {
    gameState: PhoneViewState;
    send: (action: Action) => void;
  } = $props();

  let me = $derived(gameState.me);
  let route = $derived(gameState.currentRoute!);
  let trail = $derived(route.trail);
  let myPosition = $derived(getTrailPosition(trail, me.routeProgress.totalDistance));
  let currentVP = $derived(trail.spots[myPosition].vp);

  let whiteOutChance = $derived.by(() => {
    if (me.routeProgress.pokemonDrawn === 0) return null;
    const remaining = me.deck.drawPile.length > 0 ? me.deck.drawPile : me.deck.discard;
    if (remaining.length === 0) return 100;
    const bustCards = remaining.filter(p => me.routeProgress.totalCost + p.cost > me.bustThreshold);
    return Math.round((bustCards.length / remaining.length) * 100);
  });

  let dangerRatio = $derived(
    me.bustThreshold > 0 ? me.routeProgress.totalCost / me.bustThreshold : 0
  );
  let dangerLevel = $derived<"safe" | "risky" | "danger">(
    dangerRatio >= 0.75 ? "danger" : dangerRatio >= 0.5 ? "risky" : "safe"
  );
  let nearBust = $derived(
    me.bustThreshold - me.routeProgress.totalCost <= 2 && me.routeProgress.pokemonDrawn > 0
  );

  // DOM measurement for responsive positioning
  let stripEl: HTMLDivElement;
  let spotEls = new Map<number, HTMLDivElement>();
  let scrollOffset = $state(0);
  let markerX = $state(0);

  function measurePositions() {
    if (!stripEl) return;
    const stripRect = stripEl.getBoundingClientRect();
    const spotEl = spotEls.get(myPosition);
    if (!spotEl) return;
    const spotRect = spotEl.getBoundingClientRect();

    scrollOffset = spotRect.left - stripRect.left;
    markerX = scrollOffset + (spotRect.width - 22) / 2;
  }

  $effect(() => {
    // Re-measure when position or trail changes
    myPosition;
    trail;
    requestAnimationFrame(measurePositions);
  });

  function registerSpot(el: HTMLDivElement, index: number) {
    spotEls.set(index, el);
    measurePositions();
    return {
      destroy() { spotEls.delete(index); }
    };
  }

  let lastDrawnId = $state<string | null>(null);
  let prevDrawnCount = $state(0);
  let drawnReversed = $derived([...me.deck.drawn].reverse());

  $effect(() => {
    const count = me.deck.drawn.length;
    if (count === 0) {
      lastDrawnId = null;
      prevDrawnCount = 0;
      return;
    }
    if (count > prevDrawnCount) {
      lastDrawnId = me.deck.drawn[count - 1].id;
    }
    prevDrawnCount = count;
  });

  let showBustFlash = $state(false);
  let showStopCelebration = $state(false);
  let bustTimer: ReturnType<typeof setTimeout> | null = null;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (me.status === 'busted') {
      showBustFlash = true;
      if (bustTimer) clearTimeout(bustTimer);
      bustTimer = setTimeout(() => { showBustFlash = false; bustTimer = null; }, 1000);
    }
  });

  $effect(() => {
    if (me.status === 'stopped' && me.routeProgress.pokemonDrawn > 0) {
      showStopCelebration = true;
      if (stopTimer) clearTimeout(stopTimer);
      stopTimer = setTimeout(() => { showStopCelebration = false; stopTimer = null; }, 1500);
    }
  });

  function hit() { send({ type: 'hit', trainerId: me.id }); }
  function stop() { send({ type: 'stop', trainerId: me.id }); }
  function choosePenalty(choice: 'keep_score' | 'keep_currency') {
    send({ type: 'choose_bust_penalty', trainerId: me.id, choice });
  }
</script>

<section>
  {#if showBustFlash}
    <div class="bust-overlay"></div>
  {/if}
  {#if showStopCelebration}
    <div class="stop-celebration">
      <span class="celebration-text">Banked!</span>
    </div>
  {/if}
  <h2>{copy.route} {gameState.routeNumber}</h2>

  <div class="trail-viewport">
    <div class="trail-strip" bind:this={stripEl} style="transform: translateX(-{scrollOffset}px);">
      {#each trail.spots as spot}
        <div use:registerSpot={spot.index}>
          <TrailSpot {spot} highlighted={spot.index === myPosition} />
        </div>
      {/each}
      <span class="you-marker" style="transform: translate({markerX}px, -6px);">You</span>
    </div>
  </div>

  <p>
    {copy.distance}: <strong>{me.routeProgress.totalDistance}</strong> |
    {copy.cost}: <strong>{me.routeProgress.totalCost}</strong> / {me.bustThreshold}
  </p>

  {#if me.status === 'exploring'}
    <div class="fatigue-bar" class:near-bust={nearBust}>
      <div class="fatigue-fill {dangerLevel}" style="width: {Math.min(dangerRatio * 100, 100)}%"></div>
    </div>
  {/if}
  <p>{copy.score}: {me.score} + {currentVP} VP | {copy.currency}: {me.currency}</p>

  {#if me.status === 'exploring'}
    <div class="actions">
      <button class="hit-btn" class:on-edge={nearBust} onclick={hit}>
        {copy.hitButton}
        {#if whiteOutChance !== null}
          <span class="white-out-chance" class:danger={whiteOutChance >= 50} class:critical={whiteOutChance !== null && whiteOutChance >= 75}>{whiteOutChance}%</span>
        {/if}
      </button>
      <button class="stop-btn" onclick={stop} disabled={me.routeProgress.pokemonDrawn === 0}>{copy.stopButton}</button>
    </div>
  {:else if me.status === 'busted'}
    <p><strong>{copy.bustMessage}</strong></p>
    <p>{copy.choosePenalty}</p>
    <div class="actions">
      <button onclick={() => choosePenalty('keep_score')}>{copy.keepScoreButton} (+{currentVP} VP)</button>
      <button onclick={() => choosePenalty('keep_currency')}>{copy.keepCurrencyButton} (+{trail.spots[myPosition].currency})</button>
    </div>
  {:else if me.status === 'stopped'}
    <p>{copy.statusStopped}! {copy.waitingForOthers}</p>
  {/if}

  {#if me.deck.drawn.length > 0}
    <div class="drawn">
      <h3>{copy.drawn}</h3>
      {#each drawnReversed as pkmn (pkmn.id)}
        <div class="card-slot" class:just-drawn={pkmn.id === lastDrawnId}>
          <PokemonCard pokemon={pkmn} highlighted={pkmn.id === lastDrawnId} collapsed={pkmn.id !== lastDrawnId} />
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  section { padding: var(--space-6); text-align: center; }

  .trail-viewport {
    overflow: hidden;
    margin: 0 auto var(--space-6);
  }

  .trail-strip {
    display: flex;
    gap: 4px;
    position: relative;
    transition: transform 600ms ease-out;
  }

  .you-marker {
    position: absolute;
    bottom: 0;
    left: 0;
    font-size: var(--text-xs);
    font-weight: bold;
    color: var(--color-primary);
    transition: transform 600ms ease-out;
    pointer-events: none;
    text-align: center;
    width: var(--marker-size);
  }

  .white-out-chance { font-size: var(--text-sm); color: rgba(255, 255, 255, 0.7); font-weight: normal; }
  .white-out-chance.danger { color: #fde68a; font-weight: 600; }

  .actions { display: flex; gap: var(--space-6); justify-content: center; margin: var(--space-6) 0; }
  .hit-btn, .stop-btn { padding: var(--space-6) var(--space-8); font-size: var(--text-2xl); border: none; border-radius: var(--radius-2xl); cursor: pointer; font-weight: bold; }
  .hit-btn { background: var(--color-success); color: white; display: flex; flex-direction: column; align-items: center; gap: var(--space-1); }
  .hit-btn:hover { background: var(--color-success-hover); }
  .stop-btn { background: var(--color-danger); color: white; }
  .stop-btn:hover { background: var(--color-danger-hover); }
  .stop-btn:disabled { opacity: 0.4; cursor: default; }
  button { padding: var(--space-5) var(--space-7); border: 1px solid var(--color-border); border-radius: var(--radius-lg); cursor: pointer; background: var(--color-bg); }
  button:hover { background: var(--color-bg-muted); }
  .card-slot {
    animation: slide-in var(--duration-enter) var(--ease-enter);
  }
  .card-slot.just-drawn {
    animation: slide-in var(--duration-enter) var(--ease-enter);
  }

  @keyframes slide-in {
    from { transform: translateY(-40px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .drawn {
    margin-top: var(--space-6);
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-4);
    max-width: 20rem;
    margin-left: auto;
    margin-right: auto;
  }

  .fatigue-bar {
    width: 100%;
    max-width: 20rem;
    height: 0.5rem;
    margin: var(--space-2) auto;
    border-radius: var(--radius-lg);
    background: var(--color-bg-muted);
    border: 1px solid var(--color-border);
    overflow: hidden;
  }
  .fatigue-fill {
    height: 100%;
    transition: width 400ms ease-out;
    border-radius: var(--radius-lg);
  }
  .fatigue-fill.safe { background: var(--color-success); }
  .fatigue-fill.risky { background: #f59e0b; }
  .fatigue-fill.danger { background: var(--color-danger); }
  .fatigue-bar.near-bust {
    animation: pulse-danger 0.8s ease-in-out infinite alternate;
  }
  @keyframes pulse-danger {
    from { box-shadow: 0 0 4px rgba(239, 68, 68, 0.3); }
    to { box-shadow: 0 0 12px rgba(239, 68, 68, 0.7); }
  }

  .hit-btn.on-edge {
    background: var(--color-danger);
    animation: shake 0.3s ease-in-out infinite;
  }
  @keyframes shake {
    0%, 100% { transform: translate(0, 0); }
    25% { transform: translate(-0.5px, -0.5px); }
    50% { transform: translate(0.5px, 0.5px); }
    75% { transform: translate(-0.5px, 0.5px); }
  }

  .white-out-chance.critical { color: #fbbf24; font-weight: 800; font-size: var(--text-lg); }


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
</style>
