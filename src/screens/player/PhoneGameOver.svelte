<script lang="ts">
  import type { PhoneViewState } from '../../../engine/types';
  import { copy } from '../../../copy';

  let { gameState }: {
    gameState: PhoneViewState;
  } = $props();

  let me = $derived(gameState.me);
  let allTrainers = $derived(
    [
      ...(me ? [{ name: me.name, score: me.score }] : []),
      ...Object.values(gameState.otherTrainers).map(t => ({ name: t.name, score: t.score })),
    ].sort((a, b) => b.score - a.score)
  );
  let myRank = $derived(allTrainers.findIndex(t => t.name === me?.name) + 1);
</script>

<section>
  <h2>{copy.gameOver}</h2>
  <p class="your-score">{copy.yourScore}: <strong>{me?.score ?? 0}</strong></p>
  <p>{copy.rank}: #{myRank} of {allTrainers.length}</p>

  <div class="standings">
    {#each allTrainers as trainer, i}
      <div class="row" class:you={trainer.name === me?.name}>
        #{i + 1} <strong>{trainer.name}</strong> — {trainer.score}
      </div>
    {/each}
  </div>
</section>

<style>
  section { padding: var(--space-6); text-align: center; }
  .your-score { font-size: var(--text-3xl); }
  .standings { text-align: left; margin-top: var(--space-6); }
  .row { padding: 0.3rem 0; }
  .row.you { font-weight: bold; color: var(--color-primary); }
</style>
