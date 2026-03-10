<script lang="ts">
  import type { PhoneViewState, Action } from '../../../engine/types';
  import { copy } from '../../../copy';

  let { gameState, send }: {
    gameState: PhoneViewState;
    send: (action: Action) => void;
  } = $props();

  let me = $derived(gameState.me);
  let allTrainers = $derived([
    { id: me.id, name: me.name, bot: me.bot },
    ...Object.values(gameState.otherTrainers).map(t => ({ id: t.id, name: t.name, bot: t.bot })),
  ]);
  let trainerCount = $derived(allTrainers.length);
  let canAddBot = $derived(trainerCount < gameState.settings.maxTrainers);

  function startGame() {
    send({ type: 'start_game', trainerId: me.id });
  }

  function addBot(strategy: "aggressive" | "conservative" | "random") {
    send({ type: 'add_bot', strategy });
  }
</script>

<section>
  <h2>{copy.waitingForStart}</h2>
  <p>{copy.youAre}: <strong>{me.name}</strong></p>

  <div class="trainer-list">
    {#each allTrainers as trainer}
      <div class="trainer-row">
        {trainer.name}
        {#if trainer.bot}<span class="bot-badge">{copy.botLabel}</span>{/if}
      </div>
    {/each}
  </div>

  <div class="bot-buttons">
    <button onclick={() => addBot('aggressive')} disabled={!canAddBot}>{copy.addBotAggressive}</button>
    <button onclick={() => addBot('conservative')} disabled={!canAddBot}>{copy.addBotConservative}</button>
    <button onclick={() => addBot('random')} disabled={!canAddBot}>{copy.addBotRandom}</button>
  </div>

  <button class="btn-primary" onclick={startGame} disabled={allTrainers.length < 1}>{copy.startGameButton}</button>
</section>

<style>
  section { padding: var(--space-6); text-align: center; }
  .trainer-list { margin: var(--space-6) 0; }
  .trainer-row { padding: var(--space-2) 0; font-size: var(--text-lg); }
  .bot-badge { font-size: var(--text-sm); color: var(--color-text-muted); margin-left: var(--space-2); }
  .bot-buttons { display: flex; gap: var(--space-3); justify-content: center; margin: var(--space-4) 0; flex-wrap: wrap; }
  .bot-buttons button { padding: var(--space-3) var(--space-5); font-size: var(--text-sm); border: 1px solid var(--color-border); border-radius: var(--radius-xs); background: var(--color-bg); cursor: pointer; }
  .bot-buttons button:hover { background: var(--color-bg-hover); }
  .bot-buttons button:disabled { opacity: 0.4; cursor: default; }
  button { margin-top: var(--space-6); }
</style>
