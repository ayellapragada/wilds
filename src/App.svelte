<script lang="ts">
  import { untrack } from 'svelte';
  import { createConnection, type ServerMessage, type ConnectionStatus } from './lib/connection';
  import type { Action, TVViewState, PhoneViewState } from '../engine/types';
  import { EventQueueManager } from './lib/event-queue';
  import Sandbox from './Sandbox.svelte';
  import GameScreen from './screens/game/GameScreen.svelte';
  import PlayerScreen from './screens/player/PlayerScreen.svelte';
  import { copy } from '../copy';

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
  <div class="connection-banner reconnecting">{copy.reconnecting}</div>
{:else if connectionStatus === 'disconnected' && route.screen !== 'landing' && route.screen !== 'sandbox'}
  <div class="connection-banner disconnected">{copy.disconnected}</div>
{/if}

{#if route.screen === 'sandbox'}
  <Sandbox />
{:else if route.screen === 'landing'}
  <main>
    <h1>Wilds</h1>
    <a href="#/sandbox" class="nav-link">Sandbox →</a>
    <section>
      <h2>{copy.joinRoom}</h2>
      <input bind:value={roomInput} placeholder={copy.roomCode} />
      <div class="join-buttons">
        <button onclick={goToGame} disabled={!roomInput}>{copy.tvDisplay}</button>
        <button onclick={goToPlayer} disabled={!roomInput}>{copy.phoneController}</button>
      </div>
    </section>
  </main>
{:else if route.screen === 'game' && gameState?.type === 'tv'}
  <main>
    <h1>Wilds</h1>
    <a href="#/" class="nav-link">← Back</a>
    <GameScreen gameState={gameState} />
  </main>
{:else if route.screen === 'player' && gameState}
  <main>
    <h1>Wilds</h1>
    <a href="#/" class="nav-link">← Back</a>
    <PlayerScreen gameState={gameState as PhoneViewState} {send} onJoin={handleJoin} />
  </main>
{:else if connectionStatus === 'connecting' || connectionStatus === 'reconnecting'}
  <main>
    <h1>Wilds</h1>
    <p>{copy.connecting}</p>
  </main>
{/if}

<style>
  main {
    max-width: 600px;
    margin: 0 auto;
    padding: var(--space-6);
  }
  section {
    margin-bottom: var(--space-7);
    padding: var(--space-6);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }
  button {
    margin: var(--space-2);
    padding: var(--space-4) var(--space-6);
    border-radius: 4px;
    border: 1px solid var(--color-border-dark);
    background: var(--color-bg);
    cursor: pointer;
  }
  button:hover { background: var(--color-bg-hover); }
  button:disabled { opacity: 0.4; cursor: default; }
  input {
    padding: var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    margin-right: var(--space-4);
  }
  .join-buttons {
    display: flex;
    gap: var(--space-4);
    margin-top: var(--space-4);
  }
  .connection-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    padding: var(--space-4);
    text-align: center;
    font-size: var(--text-base);
    z-index: 100;
  }
  .connection-banner.reconnecting {
    background: var(--color-warning-bg);
    color: var(--color-warning-text);
  }
  .connection-banner.disconnected {
    background: var(--color-error-bg);
    color: var(--color-error-text);
  }
  .nav-link {
    font-size: var(--text-base);
    color: var(--color-text-muted);
  }
</style>
