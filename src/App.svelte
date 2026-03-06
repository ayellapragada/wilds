<script lang="ts">
  import { createConnection, type ServerMessage } from './lib/connection';
  import type { Action, TVViewState, PhoneViewState } from '../engine/types';
  import Sandbox from './Sandbox.svelte';
  import GameScreen from './screens/game/GameScreen.svelte';
  import PlayerScreen from './screens/player/PlayerScreen.svelte';

  let hash = $state(window.location.hash);
  window.addEventListener('hashchange', () => { hash = window.location.hash; });

  // Parse hash: #/{roomCode}/game, #/{roomCode}/player, #/sandbox
  let route = $derived.by(() => {
    if (hash === '#/sandbox') return { screen: 'sandbox' as const };
    const match = hash.match(/^#\/([^/]+)\/(game|player)$/);
    if (match) return { screen: match[2] as 'game' | 'player', roomCode: match[1] };
    return { screen: 'landing' as const };
  });

  let gameState = $state<TVViewState | PhoneViewState | null>(null);
  let connected = $state(false);
  let connection: ReturnType<typeof createConnection> | null = $state(null);
  let roomInput = $state('test');

  // Auto-connect when route has a room code
  $effect(() => {
    const r = route;
    if ('roomCode' in r && r.roomCode && !connected) {
      connectToRoom(r.roomCode);
    }
  });

  function connectToRoom(roomCode: string) {
    if (connection) return;
    const r = route;
    const isPlayer = 'screen' in r && r.screen === 'player';
    const token = isPlayer ? (localStorage.getItem(`wilds-token-${roomCode}`) ?? undefined) : undefined;
    const conn = createConnection(roomCode, {
      role: isPlayer ? 'phone' : 'tv',
      token,
    });
    connection = conn;

    conn.socket.addEventListener('open', () => { connected = true; });
    conn.socket.addEventListener('close', () => {
      connected = false;
      connection = null;
    });

    conn.onMessage((msg: ServerMessage) => {
      if (msg.type === 'state_sync' || msg.type === 'state_update') {
        gameState = msg.state;
      }
      if (msg.type === 'state_update' && msg.events) {
        msg.events.forEach((e: any) => console.log(`[event] ${e.type}`, e));
      }
    });
  }

  function send(action: Action) {
    connection?.send(action);
  }

  function handleJoin(token: string) {
    // Reconnect with the new token so server associates this connection with the trainer
    const r = route;
    if ('roomCode' in r && r.roomCode) {
      connection?.close();
      connection = null;
      connected = false;
      gameState = null;
      localStorage.setItem(`wilds-token-${r.roomCode}`, token);
      connectToRoom(r.roomCode);
    }
  }

  function goToGame() {
    if (!roomInput) return;
    window.location.hash = `#/${roomInput}/game`;
  }

  function goToPlayer() {
    if (!roomInput) return;
    window.location.hash = `#/${roomInput}/player`;
  }
</script>

{#if route.screen === 'sandbox'}
  <Sandbox />
{:else if route.screen === 'landing'}
  <main>
    <h1>Wilds</h1>
    <a href="#/sandbox" style="font-size: 0.85rem; color: #666;">Sandbox →</a>
    <section>
      <h2>Join a Room</h2>
      <input bind:value={roomInput} placeholder="Room code" />
      <div class="join-buttons">
        <button onclick={goToGame} disabled={!roomInput}>TV Display</button>
        <button onclick={goToPlayer} disabled={!roomInput}>Phone Controller</button>
      </div>
    </section>
  </main>
{:else if route.screen === 'game' && gameState?.type === 'tv'}
  <main>
    <h1>Wilds</h1>
    <a href="#/" style="font-size: 0.85rem; color: #666;">← Back</a>
    <GameScreen gameState={gameState} />
  </main>
{:else if route.screen === 'player' && gameState}
  <main>
    <h1>Wilds</h1>
    <a href="#/" style="font-size: 0.85rem; color: #666;">← Back</a>
    <PlayerScreen gameState={gameState as PhoneViewState} {send} onJoin={handleJoin} />
  </main>
{:else if connected && !gameState}
  <main>
    <h1>Wilds</h1>
    <p>Connecting...</p>
  </main>
{/if}

<style>
  main {
    font-family: system-ui, sans-serif;
    max-width: 600px;
    margin: 0 auto;
    padding: 1rem;
  }
  section {
    margin-bottom: 1.5rem;
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 8px;
  }
  button {
    margin: 0.25rem;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: 1px solid #666;
    background: #fff;
    cursor: pointer;
  }
  button:hover { background: #eee; }
  button:disabled { opacity: 0.4; cursor: default; }
  input {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    margin-right: 0.5rem;
  }
  .join-buttons {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
</style>
