<script lang="ts">
  import type { GameState, Action, Trainer } from '../../../engine/types';

  let { gameState, myId, send, onJoin }: {
    gameState: GameState;
    myId: string;
    send: (action: Action) => void;
    onJoin: (id: string) => void;
  } = $props();

  let trainerName = $state('');
  let trainerList = $derived(Object.values(gameState.trainers) as Trainer[]);
  let myTrainer = $derived(gameState.trainers[myId] ?? null);

  function join() {
    if (!trainerName) return;
    const token = crypto.randomUUID().slice(0, 8);
    send({ type: 'join_game', trainerName, sessionToken: token });
    onJoin(token);
  }

  function startGame() {
    send({ type: 'start_game', trainerId: myId });
  }
</script>

{#if !myId}
  <section>
    <h2>Lobby</h2>
    <p>Phase: {gameState.phase}</p>
    {#if trainerList.length > 0}
      <p>Trainers: {trainerList.map(t => t.name).join(', ')}</p>
    {:else}
      <p>No trainers yet.</p>
    {/if}
    <input bind:value={trainerName} placeholder="Your name" />
    <button onclick={join} disabled={!trainerName}>Join</button>
  </section>
{:else}
  <section>
    <h2>Lobby</h2>
    <p>Trainers: {trainerList.map(t => t.name).join(', ')}</p>
    <p>You are: <strong>{myTrainer?.name}</strong></p>
    <button onclick={startGame} disabled={trainerList.length < 1}>Start Game</button>
  </section>
{/if}

<style>
  section {
    margin-bottom: 1.5rem;
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 8px;
  }
</style>
