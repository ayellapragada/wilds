<script lang="ts">
  import type { TVViewState, TrainerPublicInfo } from '../../../engine/types';
  import { copy } from '../../../copy';

  let { gameState }: {
    gameState: TVViewState;
  } = $props();

  let trainerList = $derived(Object.values(gameState.trainers) as TrainerPublicInfo[]);
</script>

<section>
  <h2>{copy.route} {gameState.routeNumber} — {gameState.currentRoute?.name}</h2>

  <div class="trainers">
    {#each trainerList as trainer}
      <div class="trainer-row">
        <strong>{trainer.name}</strong>
        — {trainer.status}
        | {copy.distance.toLowerCase()}: {trainer.routeProgress.totalDistance}
        | {copy.cost.toLowerCase()}: {trainer.routeProgress.totalCost}
        | {copy.score.toLowerCase()}: {trainer.score}
      </div>
    {/each}
  </div>
</section>

<style>
  section { margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #ccc; border-radius: 8px; }
  .trainer-row { padding: 0.25rem 0; font-size: 0.9rem; }
</style>
