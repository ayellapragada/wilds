<script lang="ts">
  import type { TVViewState, TrainerPublicInfo } from '../../../engine/types';

  let { gameState }: {
    gameState: TVViewState;
  } = $props();

  let sortedTrainers = $derived(
    (Object.values(gameState.trainers) as TrainerPublicInfo[])
      .sort((a, b) => b.score - a.score)
  );
</script>

<section>
  <h2>Game Over!</h2>

  <div class="standings">
    {#each sortedTrainers as trainer, i}
      <div class="trainer-row" class:champion={i === 0}>
        <span class="rank">#{i + 1}</span>
        <strong>{trainer.name}</strong>
        — Score: {trainer.score} | Currency: {trainer.currency}
      </div>
    {/each}
  </div>
</section>

<style>
  section { margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #ccc; border-radius: 8px; text-align: center; }
  .standings { text-align: left; margin-top: 1rem; }
  .trainer-row { padding: 0.5rem 0; font-size: 1rem; }
  .trainer-row.champion { font-size: 1.2rem; color: #c8a020; }
  .rank { margin-right: 0.5rem; color: #888; }
</style>
