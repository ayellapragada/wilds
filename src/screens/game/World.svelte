<script lang="ts">
  import type { GameState, Action, Trainer } from '../../../engine/types';
  import { getAvailableNodes } from '../../../engine/models/world-map';

  let { gameState, myId, send }: {
    gameState: GameState;
    myId: string;
    send: (action: Action) => void;
  } = $props();

  let trainerList = $derived(Object.values(gameState.trainers) as Trainer[]);
  let availableNodes = $derived(gameState.map ? getAvailableNodes(gameState.map) : []);
  let myVote = $derived(gameState.votes?.[myId] ?? null);
  let voteCount = $derived(Object.keys(gameState.votes ?? {}).length);
  let trainerCount = $derived(Object.keys(gameState.trainers).length);

  function castVote(nodeId: string) {
    send({ type: 'cast_vote', trainerId: myId, nodeId });
  }
</script>

<section>
  <h2>Choose Next Route</h2>
  <p>Route {gameState.routeNumber} complete! Vote on where to go next.</p>

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
        {#if node.modifiers.length > 0}
          <span class="node-mods">{node.modifiers.map(m => m.description).join(', ')}</span>
        {/if}
      </button>
    {/each}
  </div>

  <p class="vote-status">
    {#if myVote}
      You voted for <strong>{gameState.map?.nodes[myVote]?.name}</strong>.
    {:else}
      Tap a route to vote.
    {/if}
    — {voteCount}/{trainerCount} voted
  </p>

  <div class="other-trainers">
    <h3>Standings</h3>
    {#each trainerList as trainer}
      <div class="trainer-row" class:me={trainer.id === myId}>
        <strong>{trainer.name}</strong>
        {#if trainer.id === myId}(you){/if}
        — Score: {trainer.score} | Currency: {trainer.currency}
        {#if gameState.votes?.[trainer.id]}
          <span class="voted-badge">voted</span>
        {/if}
      </div>
    {/each}
  </div>
</section>

<style>
  section {
    margin-bottom: 1.5rem;
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 8px;
  }
  .vote-options {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 1rem 0;
  }
  .vote-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
    padding: 0.75rem 1rem;
    border: 2px solid #ccc;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    text-align: left;
    width: 100%;
  }
  .vote-card:hover { border-color: #888; background: #f8f8f8; }
  .vote-card.selected { border-color: #4a90d9; background: #eef4ff; }
  .node-type {
    font-size: 0.75rem;
    text-transform: uppercase;
    color: #888;
    letter-spacing: 0.05em;
  }
  .node-bonus {
    font-size: 0.8rem;
    color: #2a7a2a;
    font-weight: 500;
  }
  .node-mods {
    font-size: 0.8rem;
    color: #666;
    font-style: italic;
  }
  .vote-status {
    font-size: 0.9rem;
    color: #555;
  }
  .trainer-row { padding: 0.25rem 0; font-size: 0.9rem; }
  .trainer-row.me { font-weight: bold; }
  .voted-badge {
    font-size: 0.75rem;
    background: #e0ffe0;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    color: #2a7a2a;
    margin-left: 0.25rem;
  }
</style>
