<script lang="ts">
  import { untrack } from 'svelte';
  import { createConnection, type ServerMessage, type ConnectionStatus } from './lib/connection';
  import type { Action, TVViewState, PhoneViewState } from '../engine/types';
  import { EventQueueManager } from './lib/event-queue';
  import Sandbox from './Sandbox.svelte';
  import GameScreen from './screens/game/GameScreen.svelte';
  import PlayerScreen from './screens/player/PlayerScreen.svelte';

  let hash = $state(window.location.hash);
  window.addEventListener('hashchange', () => { hash = window.location.hash; });

  let route = $derived.by(() => {
    if (hash === '#/sandbox') return { screen: 'sandbox' as const };
    const match = hash.match(/^#\/([^/]+)\/(game|player)$/);
    if (match) return { screen: match[2] as 'game' | 'player', roomCode: match[1] };
    return { screen: 'landing' as const };
  });

  let gameState = $state<TVViewState | PhoneViewState | null>(null);
  let connectionStatus = $state<ConnectionStatus>("disconnected");
  let currentConnection: ReturnType<typeof createConnection> | null = null;
  let roomInput = $state('test');
  let connectionKey = $state(0);
  const eventQueue = new EventQueueManager(500);

  $effect(() => {
    const _key = connectionKey; // track reconnection requests
    const r = route;
    if ('roomCode' in r && r.roomCode) {
      const { roomCode, screen } = r;
      const conn = untrack(() => {
        const isPlayer = screen === 'player';
        const token = isPlayer ? (localStorage.getItem(`wilds-token-${roomCode}`) ?? undefined) : undefined;
        return createConnection(roomCode, {
          role: isPlayer ? 'phone' : 'tv',
          token,
        }, {
          onMessage(msg: ServerMessage) {
            if (msg.type === 'state_sync' || msg.type === 'state_update') {
              gameState = msg.state;
            }
            if (msg.type === 'state_update' && msg.events) {
              eventQueue.queueEvents(msg.events);
            }
          },
          onStatusChange(status: ConnectionStatus) {
            connectionStatus = status;
          },
        });
      });
      currentConnection = conn;
      return () => {
        conn.close();
        currentConnection = null;
        connectionStatus = "disconnected";
        gameState = null;
      };
    }
  });

  function send(action: Action) {
    currentConnection?.send(action);
  }

  function handleJoin(token: string) {
    const r = route;
    if ('roomCode' in r && r.roomCode) {
      localStorage.setItem(`wilds-token-${r.roomCode}`, token);
      connectionKey++; // force effect to re-run with new token
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

{#if connectionStatus === 'reconnecting'}
  <div class="connection-banner reconnecting">Reconnecting...</div>
{:else if connectionStatus === 'disconnected' && route.screen !== 'landing' && route.screen !== 'sandbox'}
  <div class="connection-banner disconnected">Disconnected. Refresh to try again.</div>
{/if}

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
{:else if connectionStatus === 'connecting' || connectionStatus === 'reconnecting'}
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
  .connection-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    padding: 0.5rem;
    text-align: center;
    font-size: 0.85rem;
    z-index: 100;
  }
  .connection-banner.reconnecting {
    background: #fff3cd;
    color: #856404;
  }
  .connection-banner.disconnected {
    background: #f8d7da;
    color: #721c24;
  }
</style>
