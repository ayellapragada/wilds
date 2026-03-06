<script lang="ts">
  import type { Action } from '../../../engine/types';

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
  <h2>Join Game</h2>
  <p>Room: <strong>{roomCode}</strong></p>
  <input bind:value={trainerName} placeholder="Your name" />
  <button onclick={join} disabled={!trainerName}>Join</button>
</section>

<style>
  section { padding: 1rem; text-align: center; }
  input { padding: 0.75rem; font-size: 1.1rem; border: 1px solid #ccc; border-radius: 8px; width: 100%; max-width: 300px; margin-bottom: 1rem; }
  button { padding: 0.75rem 2rem; font-size: 1.1rem; background: #4a90d9; color: white; border: none; border-radius: 8px; cursor: pointer; }
  button:hover { background: #3a7cc9; }
  button:disabled { opacity: 0.4; cursor: default; }
</style>
