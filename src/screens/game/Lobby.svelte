<script lang="ts">
  import type { TVViewState, TrainerPublicInfo } from '../../../engine/types';

  let { gameState }: {
    gameState: TVViewState;
  } = $props();

  let trainerList = $derived(Object.values(gameState.trainers) as TrainerPublicInfo[]);
  let playerUrl = $derived(`${window.location.origin}${window.location.pathname}#/${gameState.roomCode}/player`);
</script>

<section>
  <h2>Lobby</h2>
  <div class="join-info">
    <p class="room-code">Room: <strong>{gameState.roomCode}</strong></p>
    <p class="join-url">{playerUrl}</p>
  </div>

  {#if trainerList.length > 0}
    <div class="trainer-list">
      <h3>Trainers ({trainerList.length})</h3>
      {#each trainerList as trainer}
        <div class="trainer-row">{trainer.name}</div>
      {/each}
    </div>
  {:else}
    <p>Waiting for trainers to join...</p>
  {/if}
</section>

<style>
  section { margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #ccc; border-radius: 8px; }
  .join-info { background: #f0f8ff; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; text-align: center; }
  .room-code { font-size: 2rem; margin: 0; }
  .join-url { font-size: 0.8rem; color: #666; word-break: break-all; }
  .trainer-list { margin-top: 1rem; }
  .trainer-row { padding: 0.25rem 0; font-size: 1rem; }
</style>
