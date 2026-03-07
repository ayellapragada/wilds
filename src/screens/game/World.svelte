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
  section { margin-bottom: var(--space-7); padding: var(--space-6); border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
  .vote-options { display: flex; flex-direction: column; gap: var(--space-5); margin: var(--space-6) 0; }
  .vote-card { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-2); padding: var(--space-5) var(--space-6); border: 2px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-bg); }
  .node-type { font-size: var(--text-sm); text-transform: uppercase; color: var(--color-text-dim); }
  .node-bonus { font-size: 0.8rem; color: var(--color-success-confirmed); font-weight: 500; }
  .node-mods { font-size: 0.8rem; color: var(--color-text-muted); font-style: italic; }
  .vote-status { font-size: var(--text-md); color: var(--color-text-secondary); }
  .trainer-row { padding: var(--space-2) 0; font-size: var(--text-md); }
  .badge { font-size: var(--text-sm); background: var(--color-success-confirmed-bg); padding: 0.1rem 0.4rem; border-radius: 4px; color: var(--color-success-confirmed); margin-left: var(--space-2); }
</style>
