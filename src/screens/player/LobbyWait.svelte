<script lang="ts">
  import type { PhoneViewState, Action } from '../../../engine/types';
  import { copy } from '../../../copy';
  import { AVATAR_COUNT } from '../../lib/avatars';
  import Sprite from '../../components/Sprite.svelte';

  let { gameState, send }: {
    gameState: PhoneViewState;
    send: (action: Action) => void;
  } = $props();

  let me = $derived(gameState.me);
  let allTrainers = $derived([
    { id: me.id, name: me.name, bot: me.bot, avatar: me.avatar },
    ...Object.values(gameState.otherTrainers).map(t => ({ id: t.id, name: t.name, bot: t.bot, avatar: t.avatar })),
  ]);
  let trainerCount = $derived(allTrainers.length);
  let canAddBot = $derived(trainerCount < gameState.settings.maxTrainers);

  let takenAvatars = $derived(new Set(allTrainers.filter(t => t.id !== me.id).map(t => t.avatar)));

  function nextAvatar() {
    for (let i = 1; i < AVATAR_COUNT; i++) {
      const candidate = (me.avatar + i) % AVATAR_COUNT;
      if (!takenAvatars.has(candidate)) {
        send({ type: 'select_avatar', trainerId: me.id, avatar: candidate });
        return;
      }
    }
  }

  function prevAvatar() {
    for (let i = 1; i < AVATAR_COUNT; i++) {
      const candidate = (me.avatar - i + AVATAR_COUNT) % AVATAR_COUNT;
      if (!takenAvatars.has(candidate)) {
        send({ type: 'select_avatar', trainerId: me.id, avatar: candidate });
        return;
      }
    }
  }

  function startGame() {
    send({ type: 'start_game', trainerId: me.id });
  }

  function addBot(strategy: "aggressive" | "conservative" | "random") {
    send({ type: 'add_bot', strategy });
  }
</script>

<section>
  <h2>{copy.waitingForStart}</h2>

  <div class="avatar-picker">
    <button class="arrow-btn" onclick={prevAvatar}>&lt;</button>
    <Sprite avatarId={me.avatar} scale={3} />
    <button class="arrow-btn" onclick={nextAvatar}>&gt;</button>
  </div>

  <p><strong>{me.name}</strong></p>

  {#if Object.keys(gameState.otherTrainers).length > 0}
    <div class="trainer-list">
      {#each Object.values(gameState.otherTrainers) as trainer}
        <div class="trainer-row">
          {trainer.name}
          {#if trainer.bot}<span class="bot-badge">{copy.botLabel}</span>{/if}
        </div>
      {/each}
    </div>
  {/if}

  <div class="bot-buttons">
    <button onclick={() => addBot('aggressive')} disabled={!canAddBot}>{copy.addBotAggressive}</button>
    <button onclick={() => addBot('conservative')} disabled={!canAddBot}>{copy.addBotConservative}</button>
    <button onclick={() => addBot('random')} disabled={!canAddBot}>{copy.addBotRandom}</button>
  </div>

  <button class="btn-primary" onclick={startGame} disabled={allTrainers.length < 1}>{copy.startGameButton}</button>
</section>

<style>
  section { padding: var(--space-6); text-align: center; }
  .avatar-picker { display: flex; align-items: center; justify-content: center; gap: var(--space-4); margin: var(--space-4) 0; }
  .arrow-btn { font-size: var(--text-2xl); padding: var(--space-3) var(--space-5); border: 1px solid var(--color-border); border-radius: var(--radius-xs); background: var(--color-bg); cursor: pointer; }
  .arrow-btn:hover { background: var(--color-bg-hover); }
  .trainer-list { margin: var(--space-6) 0; }
  .trainer-row { padding: var(--space-2) 0; font-size: var(--text-lg); display: flex; align-items: center; justify-content: center; gap: var(--space-3); }
  .bot-badge { font-size: var(--text-sm); color: var(--color-text-muted); margin-left: var(--space-2); }
  .bot-buttons { display: flex; gap: var(--space-3); justify-content: center; margin: var(--space-4) 0; flex-wrap: wrap; }
  .bot-buttons button { padding: var(--space-3) var(--space-5); font-size: var(--text-sm); border: 1px solid var(--color-border); border-radius: var(--radius-xs); background: var(--color-bg); cursor: pointer; }
  .bot-buttons button:hover { background: var(--color-bg-hover); }
  .bot-buttons button:disabled { opacity: 0.4; cursor: default; }
  button { margin-top: var(--space-6); }
</style>
