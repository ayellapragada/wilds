<script lang="ts">
  import type { PhoneViewState, Action, TrailSpot } from '../../../engine/types';
  import { getTrailPosition } from '../../../engine/models/trail';
  import { copy } from '../../../copy';
  import PokemonCard from '../../components/PokemonCard.svelte';

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
        <div class="spot" class:current={i === 0}>
          <span class="vp">{spot.vp}</span>
          {#if i === 0}
            <span class="you">You</span>
          {/if}
        </div>
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
      <button onclick={() => choosePenalty('keep_currency')}>{copy.keepCurrencyButton} (+{Math.floor(me.routeProgress.totalDistance / 3)})</button>
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
  section { padding: 1rem; text-align: center; }

  .trail-window {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    margin-bottom: 1rem;
    overflow-x: auto;
  }

  .spot {
    width: 52px;
    height: 52px;
    border: 2px solid #8b9b6b;
    border-radius: 6px;
    background: #c8e6a0;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .spot.current { border-color: #4a90d9; border-width: 3px; background: #d4eaff; }

  .vp {
    position: absolute;
    top: 2px;
    right: 4px;
    font-size: 0.6rem;
    font-weight: bold;
    color: #4a6a2a;
  }

  .you {
    font-size: 0.65rem;
    font-weight: bold;
    color: #4a90d9;
  }

  .connector { color: #999; font-size: 0.8rem; }

  .white-out-chance { font-size: 0.75rem; color: rgba(255, 255, 255, 0.85); font-weight: normal; }
  .white-out-chance.danger { color: #ffcdd2; font-weight: 600; }

  .actions { display: flex; gap: 1rem; justify-content: center; margin: 1rem 0; }
  .hit-btn, .stop-btn { padding: 1rem 2rem; font-size: 1.3rem; border: none; border-radius: 12px; cursor: pointer; font-weight: bold; }
  .hit-btn { background: #4caf50; color: white; display: flex; flex-direction: column; align-items: center; gap: 0.15rem; }
  .hit-btn:hover { background: #45a049; }
  .stop-btn { background: #f44336; color: white; }
  .stop-btn:hover { background: #e53935; }
  .stop-btn:disabled { opacity: 0.4; cursor: default; }
  button { padding: 0.75rem 1.5rem; border: 1px solid #ccc; border-radius: 8px; cursor: pointer; background: #fff; }
  button:hover { background: #f0f0f0; }
  .card-slot {
    animation: slide-in 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .card-slot.just-drawn {
    animation: slide-in 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes slide-in {
    from { transform: translateY(-40px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .drawn {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
    max-width: 20rem;
    margin-left: auto;
    margin-right: auto;
  }
</style>
