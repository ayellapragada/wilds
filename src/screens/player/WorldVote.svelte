<script lang="ts">
  import type { PhoneViewState, Action } from '../../../engine/types';
  import { getAvailableNodes } from '../../../engine/models/world-map';

  let { gameState, send }: {
    gameState: PhoneViewState;
    send: (action: Action) => void;
  } = $props();

  let me = $derived(gameState.me);
  let availableNodes = $derived(gameState.map ? getAvailableNodes(gameState.map) : []);
  let myVote = $derived(gameState.votes?.[me.id] ?? null);

  function castVote(nodeId: string) {
    send({ type: 'cast_vote', trainerId: me.id, nodeId });
  }
</script>

<section>
  <h2>Vote on Next Route</h2>

  <div class="vote-options">
    {#each availableNodes as node}
      <button
        class="vote-card"
        class:selected={myVote === node.id}
        onclick={() => castVote(node.id)}
      >
        <strong>{node.name}</strong>
        <span class="node-type">{node.type === 'elite_route' ? 'Elite' : node.type === 'champion' ? 'Champion' : 'Route'}</span>
        {#if node.bonus}
          <span class="node-bonus">+ {node.bonus.replace('_', ' ')}</span>
        {/if}
      </button>
    {/each}
  </div>

  {#if myVote}
    <p>You voted for <strong>{gameState.map?.nodes[myVote]?.name}</strong></p>
  {:else}
    <p>Tap a route to vote</p>
  {/if}
</section>

<style>
  section { padding: 1rem; text-align: center; }
  .vote-options { display: flex; flex-direction: column; gap: 0.75rem; margin: 1rem 0; }
  .vote-card { display: flex; flex-direction: column; align-items: flex-start; gap: 0.25rem; padding: 0.75rem 1rem; border: 2px solid #ccc; border-radius: 8px; background: #fff; cursor: pointer; text-align: left; width: 100%; }
  .vote-card:hover { border-color: #888; }
  .vote-card.selected { border-color: #4a90d9; background: #eef4ff; }
  .node-type { font-size: 0.75rem; text-transform: uppercase; color: #888; }
  .node-bonus { font-size: 0.8rem; color: #2a7a2a; }
</style>
