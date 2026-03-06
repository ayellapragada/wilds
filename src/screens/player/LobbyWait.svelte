<script lang="ts">
  import type { PhoneViewState, Action } from '../../../engine/types';

  let { gameState, send }: {
    gameState: PhoneViewState;
    send: (action: Action) => void;
  } = $props();

  let allTrainers = $derived([
    ...(gameState.me ? [{ id: gameState.me.id, name: gameState.me.name }] : []),
    ...Object.values(gameState.otherTrainers).map(t => ({ id: t.id, name: t.name })),
  ]);

  function startGame() {
    if (!gameState.me) return;
    send({ type: 'start_game', trainerId: gameState.me.id });
  }
</script>

<section>
  <h2>Waiting for game to start...</h2>
  <p>You are: <strong>{gameState.me?.name}</strong></p>

  <div class="trainer-list">
    {#each allTrainers as trainer}
      <div class="trainer-row">{trainer.name}</div>
    {/each}
  </div>

  <button onclick={startGame} disabled={allTrainers.length < 1}>Start Game</button>
</section>

<style>
  section { padding: 1rem; text-align: center; }
  .trainer-list { margin: 1rem 0; }
  .trainer-row { padding: 0.25rem 0; font-size: 1rem; }
  button { padding: 0.75rem 2rem; font-size: 1.1rem; background: #4a90d9; color: white; border: none; border-radius: 8px; cursor: pointer; margin-top: 1rem; }
  button:hover { background: #3a7cc9; }
  button:disabled { opacity: 0.4; cursor: default; }
</style>
