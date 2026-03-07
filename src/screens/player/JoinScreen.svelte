<script lang="ts">
  import type { Action } from '../../../engine/types';
  import { copy } from '../../../copy';

  let { roomCode, send, onJoin }: {
    roomCode: string;
    send: (action: Action) => void;
    onJoin: (token: string) => void;
  } = $props();

  let trainerName = $state('');

  function join() {
    if (!trainerName) return;
    const token = crypto.randomUUID().slice(0, 8);
    send({ type: 'join_game', trainerName, sessionToken: token });
    localStorage.setItem(`wilds-token-${roomCode}`, token);
    onJoin(token);
  }
</script>

<section>
  <h2>{copy.joinButton} Game</h2>
  <p>{copy.room}: <strong>{roomCode}</strong></p>
  <input bind:value={trainerName} placeholder="Your name" />
  <button class="btn-primary" onclick={join} disabled={!trainerName}>{copy.joinButton}</button>
</section>

<style>
  section { padding: var(--space-6); text-align: center; }
  input { padding: var(--space-5); font-size: var(--text-xl); border: 1px solid var(--color-border); border-radius: var(--radius-lg); width: 100%; max-width: 300px; margin-bottom: var(--space-6); }

</style>
