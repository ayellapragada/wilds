<script lang="ts">
  import { untrack } from 'svelte';
  import { createConnection, type ServerMessage, type ConnectionStatus } from './lib/connection';
  import type { Action, TVViewState, PhoneViewState } from '../engine/types';
  import { EventQueueManager } from './lib/event-queue';
  import Sandbox from './Sandbox.svelte';
  import GameScreen from './screens/game/GameScreen.svelte';
  import PlayerScreen from './screens/player/PlayerScreen.svelte';
  import SoloScreen from './screens/solo/SoloScreen.svelte';
  import { copy } from '../copy';

  let hash = $state(window.location.hash);
  window.addEventListener('hashchange', () => { hash = window.location.hash; });

  let route = $derived.by(() => {
    if (hash === '#/sandbox') return { screen: 'sandbox' as const };
    const match = hash.match(/^#\/([^/]+)\/(game|player|solo)$/);
    if (match) return { screen: match[2] as 'game' | 'player' | 'solo', roomCode: match[1] };
    return { screen: 'landing' as const };
  });

  let gameState = $state<TVViewState | PhoneViewState | null>(null);
  let connectionStatus = $state<ConnectionStatus>("disconnected");
  let currentConnection: ReturnType<typeof createConnection> | null = null;
  let roomInput = $state('test');
  let connectionKey = $state(0);
  let tvState = $state<TVViewState | null>(null);
  let phoneState = $state<PhoneViewState | null>(null);
  let soloConnectionStatus = $state<ConnectionStatus>("disconnected");
  let soloSend: ((action: Action) => void) | null = $state(null);
  const eventQueue = new EventQueueManager(500);

  $effect(() => {
    const _key = connectionKey; // track reconnection requests
    const r = route;
    if ('roomCode' in r && r.roomCode && r.screen !== 'solo') {
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

  $effect(() => {
    const r = route;
    if (r.screen !== 'solo' || !('roomCode' in r)) return;
    const { roomCode } = r;

    const token = crypto.randomUUID().slice(0, 8);
    const trainerName = 'Player';
    let hasJoined = false;
    let hasAddedBots = false;
    let hasStarted = false;

    // TV connection
    const tvConn = createConnection(roomCode, { role: 'tv' }, {
      onMessage(msg: ServerMessage) {
        if (msg.type === 'state_sync' || msg.type === 'state_update') {
          tvState = msg.state as TVViewState;
        }
        if (msg.type === 'state_update' && msg.events) {
          eventQueue.queueEvents(msg.events);
        }
      },
      onStatusChange(status: ConnectionStatus) {
        soloConnectionStatus = status;
      },
    });

    // Phone connection
    const phoneConn = createConnection(roomCode, { role: 'phone' }, {
      onMessage(msg: ServerMessage) {
        if (msg.type === 'state_sync' || msg.type === 'state_update') {
          // Before joining, server sends TVViewState to phone connections
          if (msg.state.type === 'phone') {
            phoneState = msg.state;
          }
        }

        // Auto-join on first sync
        if (msg.type === 'state_sync' && !hasJoined) {
          phoneConn.send({ type: 'join_game', trainerName, sessionToken: token });
          hasJoined = true;
        }

        // Auto-add bots after joining
        if ((msg.type === 'state_sync' || msg.type === 'state_update') && !hasAddedBots) {
          if (msg.state.type === 'phone' && msg.state.phase === 'lobby') {
            phoneConn.send({ type: 'add_bot', strategy: 'aggressive' });
            phoneConn.send({ type: 'add_bot', strategy: 'conservative' });
            phoneConn.send({ type: 'add_bot', strategy: 'random' });
            hasAddedBots = true;
          }
        }

        // Auto-start after bots added
        if ((msg.type === 'state_sync' || msg.type === 'state_update') && hasAddedBots && !hasStarted) {
          if (msg.state.type === 'phone' && msg.state.phase === 'lobby') {
            phoneConn.send({ type: 'start_game', trainerId: msg.state.me.id });
            hasStarted = true;
          }
        }
      },
      onStatusChange() {},
    });

    soloSend = (action: Action) => phoneConn.send(action);

    return () => {
      tvConn.close();
      phoneConn.close();
      tvState = null;
      phoneState = null;
      soloConnectionStatus = "disconnected";
      soloSend = null;
    };
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

  function goToSolo() {
    const roomCode = crypto.randomUUID().slice(0, 8);
    window.location.hash = `#/${roomCode}/solo`;
  }
</script>

{#if connectionStatus === 'reconnecting' || soloConnectionStatus === 'reconnecting'}
  <div class="connection-banner reconnecting">{copy.reconnecting}</div>
{:else if route.screen === 'solo' && soloConnectionStatus === 'disconnected'}
  <div class="connection-banner disconnected">{copy.disconnected}</div>
{:else if route.screen !== 'landing' && route.screen !== 'sandbox' && route.screen !== 'solo' && connectionStatus === 'disconnected'}
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
    <section>
      <button onclick={goToSolo}>{copy.playSolo}</button>
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
{:else if route.screen === 'solo' && tvState && phoneState && soloSend}
  <main>
    <h1>Wilds</h1>
    <a href="#/" class="nav-link">← Back</a>
    <SoloScreen {tvState} {phoneState} send={soloSend} />
  </main>
{:else if connectionStatus === 'connecting' || connectionStatus === 'reconnecting' || soloConnectionStatus === 'connecting'}
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
    border-radius: var(--radius-xs);
    border: 1px solid var(--color-border-dark);
    background: var(--color-bg);
    cursor: pointer;
  }
  button:hover { background: var(--color-bg-hover); }
  button:disabled { opacity: 0.4; cursor: default; }
  input {
    padding: var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xs);
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
