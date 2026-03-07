<script lang="ts">
  import type { PhoneViewState, Action } from '../../../engine/types';
  import { getTrailPosition } from '../../../engine/models/trail';
  import { copy } from '../../../copy';
  import PokemonCard from '../../components/PokemonCard.svelte';
  import TrailSpot from '../../components/TrailSpot.svelte';

  const TRAIL_WINDOW_SIZE = 5;

  let { gameState, send }: {
    gameState: PhoneViewState;
    send: (action: Action) => void;
  } = $props();

  let me = $derived(gameState.me);
  let trail = $derived(gameState.currentRoute?.trail);
  let myPosition = $derived(trail ? getTrailPosition(trail, me.routeProgress.totalDistance) : 0);
  let currentVP = $derived(trail ? trail.spots[myPosition].vp : 0);

  let whiteOutChance = $derived.by(() => {
    if (me.routeProgress.pokemonDrawn === 0) return null;
    // drawPile may be empty if all cards drawn; discard would reshuffle on next draw
    const remaining = me.deck.drawPile.length > 0 ? me.deck.drawPile : me.deck.discard;
    if (remaining.length === 0) return 100;
    const bustCards = remaining.filter(p => me.routeProgress.totalCost + p.cost > me.bustThreshold);
    return Math.round((bustCards.length / remaining.length) * 100);
  });

  // Sliding window: show current spot + next N spots
  let windowSpots = $derived.by(() => {
    if (!trail) return [];
    const start = myPosition;
    const end = Math.min(start + TRAIL_WINDOW_SIZE + 1, trail.spots.length);
    return trail.spots.slice(start, end);
  });

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

  function hit() { send({ type: 'hit', trainerId: me.id }); }
  function stop() { send({ type: 'stop', trainerId: me.id }); }
  function choosePenalty(choice: 'keep_score' | 'keep_currency') {
    send({ type: 'choose_bust_penalty', trainerId: me.id, choice });
  }
</script>

<section>
  <h2>{copy.route} {gameState.routeNumber}</h2>

  {#if trail}
    <div class="trail-window">
      {#each windowSpots as spot, i}
        <TrailSpot {spot} highlighted={i === 0}>
          {#if i === 0}
            <span class="you">You</span>
          {/if}
        </TrailSpot>
        {#if i < windowSpots.length - 1}
          <span class="connector">→</span>
        {/if}
      {/each}
    </div>
  {/if}

  <p>
    {copy.distance}: <strong>{me.routeProgress.totalDistance}</strong> |
    {copy.cost}: <strong>{me.routeProgress.totalCost}</strong> / {me.bustThreshold}
  </p>
  <p>{copy.score}: {me.score} + {currentVP} VP | {copy.currency}: {me.currency}</p>

  {#if me.status === 'exploring'}
    <div class="actions">
      <button class="hit-btn" onclick={hit}>
        {copy.hitButton}
        {#if whiteOutChance !== null}
          <span class="white-out-chance" class:danger={whiteOutChance >= 50}>{whiteOutChance}%</span>
        {/if}
      </button>
      <button class="stop-btn" onclick={stop} disabled={me.routeProgress.pokemonDrawn === 0}>{copy.stopButton}</button>
    </div>
  {:else if me.status === 'busted'}
    <p><strong>{copy.bustMessage}</strong></p>
    <p>{copy.choosePenalty}</p>
    <div class="actions">
      <button onclick={() => choosePenalty('keep_score')}>{copy.keepScoreButton} (+{currentVP} VP)</button>
      <button onclick={() => choosePenalty('keep_currency')}>{copy.keepCurrencyButton} (+{trail ? trail.spots[myPosition].currency : 0})</button>
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

  .trail-window {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    margin-bottom: var(--space-6);
    overflow-x: auto;
  }

  .you {
    font-size: var(--text-xs);
    font-weight: bold;
    color: var(--color-primary);
  }

  .connector { color: var(--color-text-faint); font-size: 0.8rem; }

  .white-out-chance { font-size: var(--text-sm); color: rgba(255, 255, 255, 0.85); font-weight: normal; }
  .white-out-chance.danger { color: #ffcdd2; font-weight: 600; }

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
</style>
