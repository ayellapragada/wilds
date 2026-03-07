<script lang="ts">
  import type { TVViewState, TrainerPublicInfo } from '../../../engine/types';
  import { copy } from '../../../copy';

  let { gameState }: {
    gameState: TVViewState;
  } = $props();

  let sortedTrainers = $derived(
    (Object.values(gameState.trainers) as TrainerPublicInfo[])
      .sort((a, b) => b.score - a.score)
  );
</script>

<section>
  <h2>{copy.gameOver}</h2>

  <div class="standings">
    {#each sortedTrainers as trainer, i}
      <div class="trainer-row" class:champion={i === 0}>
        <span class="rank">#{i + 1}</span>
        <strong>{trainer.name}</strong>
        — {copy.score}: {trainer.score} | {copy.currency}: {trainer.currency}
      </div>
    {/each}
  </div>
</section>

<style>
  section { margin-bottom: var(--space-7); padding: var(--space-6); border: 1px solid var(--color-border); border-radius: var(--radius-lg); text-align: center; }
  .standings { text-align: left; margin-top: var(--space-6); }
  .trainer-row { padding: var(--space-4) 0; font-size: var(--text-lg); }
  .trainer-row.champion { font-size: 1.2rem; color: var(--color-gold); }
  .rank { margin-right: var(--space-4); color: var(--color-text-dim); }
</style>
