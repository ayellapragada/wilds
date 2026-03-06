<script lang="ts">
  import type { PhoneViewState, Action } from '../../../engine/types';
  import { spriteUrl, typeColor } from '../../lib/assets';
  import { copy } from '../../../copy';

  let { gameState, send }: {
    gameState: PhoneViewState;
    send: (action: Action) => void;
  } = $props();

  let me = $derived(gameState.me);

  function hit() { send({ type: 'hit', trainerId: me.id }); }
  function stop() { send({ type: 'stop', trainerId: me.id }); }
  function choosePenalty(choice: 'keep_score' | 'keep_currency') {
    send({ type: 'choose_bust_penalty', trainerId: me.id, choice });
  }
</script>

<section>
  <h2>{copy.route} {gameState.routeNumber}</h2>
  <p>
    {copy.distance}: <strong>{me.routeProgress.totalDistance}</strong> |
    {copy.cost}: <strong>{me.routeProgress.totalCost}</strong> / {me.bustThreshold}
  </p>
  <p>{copy.score}: {me.score} | {copy.currency}: {me.currency}</p>

  {#if me.status === 'exploring'}
    <div class="actions">
      <button class="hit-btn" onclick={hit}>{copy.hitButton}</button>
      <button class="stop-btn" onclick={stop} disabled={me.routeProgress.pokemonDrawn === 0}>{copy.stopButton}</button>
    </div>
  {:else if me.status === 'busted'}
    <p><strong>{copy.bustMessage}</strong></p>
    <p>{copy.choosePenalty}</p>
    <div class="actions">
      <button onclick={() => choosePenalty('keep_score')}>{copy.keepScoreButton} (+{me.routeProgress.totalDistance})</button>
      <button onclick={() => choosePenalty('keep_currency')}>{copy.keepCurrencyButton} (+{Math.floor(me.routeProgress.totalDistance / 3)})</button>
    </div>
  {:else if me.status === 'stopped'}
    <p>{copy.statusStopped}! {copy.waitingForOthers}</p>
  {/if}

  {#if me.deck.drawn.length > 0}
    <div class="drawn">
      <h3>{copy.drawn}</h3>
      {#each me.deck.drawn as pkmn}
        <span class="pokemon" title={pkmn.description} style="background: {typeColor(pkmn.types)}">
          <img class="sprite" src={spriteUrl(pkmn.templateId)} alt={pkmn.name} />
          {pkmn.name} (+{pkmn.distance}{copy.distanceAbbr} / +{pkmn.cost}{copy.costAbbr})
        </span>
      {/each}
    </div>
  {/if}
</section>

<style>
  section { padding: 1rem; text-align: center; }
  .actions { display: flex; gap: 1rem; justify-content: center; margin: 1rem 0; }
  .hit-btn, .stop-btn { padding: 1rem 2rem; font-size: 1.3rem; border: none; border-radius: 12px; cursor: pointer; font-weight: bold; }
  .hit-btn { background: #4caf50; color: white; }
  .hit-btn:hover { background: #45a049; }
  .stop-btn { background: #f44336; color: white; }
  .stop-btn:hover { background: #e53935; }
  .stop-btn:disabled { opacity: 0.4; cursor: default; }
  button { padding: 0.75rem 1.5rem; border: 1px solid #ccc; border-radius: 8px; cursor: pointer; background: #fff; }
  button:hover { background: #f0f0f0; }
  .drawn { margin-top: 1rem; text-align: left; display: flex; flex-direction: column; gap: 0.5rem; }
  .sprite { width: 34px; height: 28px; image-rendering: pixelated; vertical-align: middle; margin-right: 0.25rem; }
  .pokemon { display: inline-flex; align-items: center; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem; border: 1px solid #aaa; }
</style>
