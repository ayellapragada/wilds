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
</script>

<section>
  <h2>{copy.waitingForStart}</h2>

  <div class="avatar-picker">
    <button class="arrow-btn" onclick={prevAvatar}>&lt;</button>
    <Sprite avatarId={me.avatar} scale={3} />
    <button class="arrow-btn" onclick={nextAvatar}>&gt;</button>
  </div>

  <p><strong>{me.name}</strong></p>

  <button class="btn-primary" onclick={startGame} disabled={allTrainers.length < 1}>{copy.startGameButton}</button>
</section>

<style>
  section { padding: var(--space-6); text-align: center; }
  .avatar-picker { display: flex; align-items: center; justify-content: center; gap: var(--space-4); margin: var(--space-4) 0; }
  .arrow-btn { font-size: var(--text-2xl); padding: var(--space-3) var(--space-5); border: 1px solid var(--color-border); border-radius: var(--radius-xs); background: var(--color-bg); cursor: pointer; }
  .arrow-btn:hover { background: var(--color-bg-hover); }
  button { margin-top: var(--space-6); }
</style>
