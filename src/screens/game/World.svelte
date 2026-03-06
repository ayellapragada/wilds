<script lang="ts">
  import type { TVViewState, TrainerPublicInfo } from '../../../engine/types';
  import { getAvailableNodes } from '../../../engine/models/world-map';
  import { copy } from '../../../copy';

  let { gameState }: {
    gameState: TVViewState;
  } = $props();

  let trainerList = $derived(Object.values(gameState.trainers) as TrainerPublicInfo[]);
  let availableNodes = $derived(gameState.map ? getAvailableNodes(gameState.map) : []);
  let voteCount = $derived(Object.keys(gameState.votes ?? {}).length);
  let trainerCount = $derived(Object.keys(gameState.trainers).length);
</script>

<section>
  <h2>{copy.chooseRoute}</h2>
  <p>{copy.routeComplete}</p>

  <div class="vote-options">
    {#each availableNodes as node}
      <div class="vote-card">
        <strong>{node.name}</strong>
        <span class="node-type">{node.type === 'elite_route' ? copy.elite : node.type === 'champion' ? copy.champion : copy.route}</span>
        {#if node.bonus}
          <span class="node-bonus">+ {node.bonus.replace('_', ' ')}</span>
        {/if}
        {#if node.modifiers.length > 0}
          <span class="node-mods">{node.modifiers.map(m => m.description).join(', ')}</span>
        {/if}
      </div>
    {/each}
  </div>

  <p class="vote-status">{voteCount}/{trainerCount} {copy.voted}</p>

  <div class="trainers">
    <h3>{copy.standings}</h3>
    {#each trainerList as trainer}
      <div class="trainer-row">
        <strong>{trainer.name}</strong>
        — {copy.score}: {trainer.score} | {copy.currency}: {trainer.currency}
        {#if gameState.votes?.[trainer.id]}
          <span class="badge">{copy.voted}</span>
        {/if}
      </div>
    {/each}
  </div>
</section>

<style>
  section { margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #ccc; border-radius: 8px; }
  .vote-options { display: flex; flex-direction: column; gap: 0.75rem; margin: 1rem 0; }
  .vote-card { display: flex; flex-direction: column; align-items: flex-start; gap: 0.25rem; padding: 0.75rem 1rem; border: 2px solid #ccc; border-radius: 8px; background: #fff; }
  .node-type { font-size: 0.75rem; text-transform: uppercase; color: #888; }
  .node-bonus { font-size: 0.8rem; color: #2a7a2a; font-weight: 500; }
  .node-mods { font-size: 0.8rem; color: #666; font-style: italic; }
  .vote-status { font-size: 0.9rem; color: #555; }
  .trainer-row { padding: 0.25rem 0; font-size: 0.9rem; }
  .badge { font-size: 0.75rem; background: #e0ffe0; padding: 0.1rem 0.4rem; border-radius: 4px; color: #2a7a2a; margin-left: 0.25rem; }
</style>
