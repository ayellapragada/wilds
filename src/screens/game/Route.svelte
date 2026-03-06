<script lang="ts">
  import type { TVViewState, TrainerPublicInfo } from '../../../engine/types';

  let { gameState }: {
    gameState: TVViewState;
  } = $props();

  let trainerList = $derived(Object.values(gameState.trainers) as TrainerPublicInfo[]);
</script>

<section>
  <h2>Route {gameState.routeNumber} — {gameState.currentRoute?.name}</h2>

  <div class="trainers">
    {#each trainerList as trainer}
      <div class="trainer-row">
        <strong>{trainer.name}</strong>
        — {trainer.status}
        | distance: {trainer.routeProgress.totalDistance}
        | cost: {trainer.routeProgress.totalCost}
        | score: {trainer.score}
      </div>
    {/each}
  </div>
</section>

<style>
  section { margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #ccc; border-radius: 8px; }
  .trainer-row { padding: 0.25rem 0; font-size: 0.9rem; }
</style>
