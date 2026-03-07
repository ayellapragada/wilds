<script lang="ts">
  import type { PhoneViewState, Action } from '../../../engine/types';
  import { getAvailableNodes } from '../../../engine/models/world-map';
  import { copy } from '../../../copy';
  import RouteNodeCard from '../../components/RouteNodeCard.svelte';

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
      <RouteNodeCard {node} selected={myVote === node.id} onclick={() => castVote(node.id)} />
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
</style>
