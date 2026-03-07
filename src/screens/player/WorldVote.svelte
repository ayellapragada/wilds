<script lang="ts">
  import type { PhoneViewState, Action } from '../../../engine/types';
  import { getAvailableNodes } from '../../../engine/models/world-map';
  import { copy } from '../../../copy';

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
  <h2>Vote on Next {copy.route}</h2>

  <div class="vote-options">
    {#each availableNodes as node}
      <button
        class="vote-card"
        class:selected={myVote === node.id}
        onclick={() => castVote(node.id)}
      >
        <strong>{node.name}</strong>
        <span class="node-type">{node.type === 'elite_route' ? copy.elite : node.type === 'champion' ? copy.champion : copy.route}</span>
        {#if node.bonus}
          <span class="node-bonus">+ {node.bonus.replace('_', ' ')}</span>
        {/if}
      </button>
    {/each}
  </div>

  {#if myVote}
    <p>{copy.votedFor} <strong>{gameState.map?.nodes[myVote]?.name}</strong></p>
  {:else}
    <p>{copy.votePrompt}</p>
  {/if}
</section>

<style>
  section { padding: var(--space-6); text-align: center; }
  .vote-options { display: flex; flex-direction: column; gap: var(--space-5); margin: var(--space-6) 0; }
  .vote-card { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-2); padding: var(--space-5) var(--space-6); border: 2px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-bg); cursor: pointer; text-align: left; width: 100%; }
  .vote-card:hover { border-color: var(--color-text-dim); }
  .vote-card.selected { border-color: var(--color-primary); background: var(--color-primary-bg-light); }
  .node-type { font-size: var(--text-sm); text-transform: uppercase; color: var(--color-text-dim); }
  .node-bonus { font-size: 0.8rem; color: var(--color-success-confirmed); }
</style>
