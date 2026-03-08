<script lang="ts">
  import type { PhoneViewState, Action } from '../../../engine/types';
  import { copy } from '../../../copy';

  let { gameState, send }: {
    gameState: PhoneViewState;
    send: (action: Action) => void;
  } = $props();

  let me = $derived(gameState.me);
  let allTrainers = $derived([
    { id: me.id, name: me.name },
    ...Object.values(gameState.otherTrainers).map(t => ({ id: t.id, name: t.name })),
  ]);

  function startGame() {
    send({ type: 'start_game', trainerId: me.id });
  }
</script>

<section>
  <h2>{copy.waitingForStart}</h2>
  <p>{copy.youAre}: <strong>{me.name}</strong></p>

  <div class="trainer-list">
    {#each allTrainers as trainer}
      <div class="trainer-row">{trainer.name}</div>
    {/each}
  </div>

  <button class="btn-primary" onclick={startGame} disabled={allTrainers.length < 1}>{copy.startGameButton}</button>
</section>

<style>
  section { padding: var(--space-6); text-align: center; }
  .trainer-list { margin: var(--space-6) 0; }
  .trainer-row { padding: var(--space-2) 0; font-size: var(--text-lg); }
  button { margin-top: var(--space-6); }
</style>
