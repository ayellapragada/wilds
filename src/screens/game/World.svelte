<script lang="ts">
  import type { TVViewState, TrainerPublicInfo } from '../../../engine/types';
  import { getAvailableNodes } from '../../../engine/models/world-map';
  import { copy } from '../../../copy';
  import RouteNodeCard from '../../components/RouteNodeCard.svelte';

  let { gameState }: {
    gameState: TVViewState;
  } = $props();

  let trainerList = $derived(Object.values(gameState.trainers) as TrainerPublicInfo[]);
  let map = $derived(gameState.map!);
  let votes = $derived(gameState.votes!);
  let availableNodes = $derived(getAvailableNodes(map));
  let voteCount = $derived(Object.keys(votes).length);
  let trainerCount = $derived(Object.keys(gameState.trainers).length);
</script>

<section>
  <h2>{copy.chooseRoute}</h2>
  <p>{copy.routeComplete}</p>

  <div class="vote-options">
    {#each availableNodes as node}
      <RouteNodeCard {node} />
    {/each}
  </div>

  <p class="vote-status">{voteCount}/{trainerCount} {copy.voted}</p>

  <div class="trainers">
    <h3>{copy.standings}</h3>
    {#each trainerList as trainer}
      <div class="trainer-row">
        <strong>{trainer.name}</strong>
        — {copy.score}: {trainer.score} | {copy.currency}: {trainer.currency}
        {#if votes[trainer.id]}
          <span class="badge">{copy.voted}</span>
        {/if}
      </div>
    {/each}
  </div>
</section>

<style>
  section { margin-bottom: var(--space-7); padding: var(--space-6); border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
  .vote-options { display: flex; flex-direction: column; gap: var(--space-5); margin: var(--space-6) 0; }
  .vote-status { font-size: var(--text-md); color: var(--color-text-secondary); }
  .trainer-row { padding: var(--space-2) 0; font-size: var(--text-md); }
  .badge { font-size: var(--text-sm); background: var(--color-success-confirmed-bg); padding: 0.1rem 0.4rem; border-radius: var(--radius-xs); color: var(--color-success-confirmed); margin-left: var(--space-2); }
</style>
