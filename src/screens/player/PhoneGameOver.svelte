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
