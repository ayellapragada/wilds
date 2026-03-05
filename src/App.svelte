<script lang="ts">
  import { createConnection, type ServerMessage } from './lib/connection';
  import type { GameState, Action, Trainer } from '../engine/types';
  import Sandbox from './Sandbox.svelte';

  let hash = $state(window.location.hash);
  window.addEventListener('hashchange', () => { hash = window.location.hash; });
  let isSandbox = $derived(hash === '#/sandbox');

  let gameState = $state<GameState | null>(null);
  let events: any[] = $state([]);
  let connected = $state(false);
  let roomCode = $state('test');
  let trainerName = $state('');
  let myId = $state('');
  let connection: ReturnType<typeof createConnection> | null = $state(null);

  function connect() {
    if (!roomCode) return;
    const conn = createConnection(roomCode);
    connection = conn;

    conn.socket.addEventListener('open', () => {
      connected = true;
    });

    conn.socket.addEventListener('close', () => {
      connected = false;
    });

    conn.onMessage((msg: ServerMessage) => {
      if (msg.type === 'state_sync' || msg.type === 'state_update') {
        gameState = msg.state;
      }
      if (msg.type === 'state_update' && msg.events) {
        events = [...msg.events, ...events].slice(0, 20);
      }
    });
  }

  function send(action: Action) {
    connection?.send(action);
  }

  function join() {
    if (!trainerName) return;
    const token = crypto.randomUUID().slice(0, 8);
    myId = token;
    send({ type: 'join_game', trainerName, sessionToken: token });
  }

  function startGame() {
    send({ type: 'start_game', trainerId: myId });
  }

  function hit() {
    send({ type: 'hit', trainerId: myId });
  }

  function stop() {
    send({ type: 'stop', trainerId: myId });
  }

  function choosePenalty(choice: 'keep_score' | 'keep_currency') {
    send({ type: 'choose_bust_penalty', trainerId: myId, choice });
  }

  let myTrainer = $derived(gameState?.trainers[myId] ?? null);
  let trainerList = $derived(gameState ? Object.values(gameState.trainers) as Trainer[] : [] as Trainer[]);
</script>

{#if isSandbox}
  <Sandbox />
{:else}
<main>
  <h1>Wilds</h1>
  <a href="#/sandbox" style="font-size: 0.85rem; color: #666;">Sandbox →</a>

  {#if !connected}
    <section>
      <h2>Connect</h2>
      <input bind:value={roomCode} placeholder="Room code" />
      <button onclick={connect}>Connect</button>
    </section>
  {:else if !myId}
    <section>
      <h2>Lobby — {roomCode}</h2>
      <p>Phase: {gameState?.phase}</p>
      {#if trainerList.length > 0}
        <p>Trainers: {trainerList.map(t => t.name).join(', ')}</p>
      {:else}
        <p>No trainers yet.</p>
      {/if}
      <input bind:value={trainerName} placeholder="Your name" />
      <button onclick={join} disabled={!trainerName}>Join</button>
    </section>
  {:else if gameState?.phase === 'lobby'}
    <section>
      <h2>Lobby — {roomCode}</h2>
      <p>Trainers: {trainerList.map(t => t.name).join(', ')}</p>
      <p>You are: <strong>{myTrainer?.name}</strong></p>
      <button onclick={startGame} disabled={trainerList.length < 1}>Start Game</button>
    </section>
  {:else if gameState?.phase === 'route'}
    <section>
      <h2>Route {gameState.routeNumber} — {gameState.currentRoute?.name}</h2>

      {#if myTrainer}
        <div class="my-turn">
          <h3>Your Turn</h3>
          <p>
            Distance: <strong>{myTrainer.routeProgress.totalDistance}</strong> |
            Cost: <strong>{myTrainer.routeProgress.totalCost}</strong> / {myTrainer.bustThreshold} |
            Creatures drawn: {myTrainer.routeProgress.creaturesDrawn}
          </p>
          <p>Score: {myTrainer.score} | Currency: {myTrainer.currency}</p>

          {#if myTrainer.status === 'exploring'}
            <button onclick={hit}>HIT</button>
            <button onclick={stop} disabled={myTrainer.routeProgress.creaturesDrawn === 0}>STOP</button>
          {:else if myTrainer.status === 'busted'}
            <p><strong>WENT WILD!</strong> Cost {myTrainer.routeProgress.totalCost} exceeded threshold {myTrainer.bustThreshold}.</p>
            <p>Choose one to keep:</p>
            <button onclick={() => choosePenalty('keep_score')}>
              Keep Score (+{myTrainer.routeProgress.totalDistance} distance)
            </button>
            <button onclick={() => choosePenalty('keep_currency')}>
              Keep Currency (+{Math.floor(myTrainer.routeProgress.totalDistance / 3)} currency)
            </button>
          {:else if myTrainer.status === 'stopped'}
            <p>Waiting for other trainers...</p>
          {/if}

          {#if myTrainer.deck.drawn.length > 0}
            <div class="drawn-creatures">
              <h4>Drawn this route:</h4>
              {#each myTrainer.deck.drawn as creature}
                <span class="creature {creature.type}" title={creature.description}>
                  {creature.name} (+{creature.distance}d / +{creature.cost}c)
                </span>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <div class="other-trainers">
        <h3>All Trainers</h3>
        {#each trainerList as trainer}
          <div class="trainer-row" class:me={trainer.id === myId}>
            <strong>{trainer.name}</strong>
            {#if trainer.id === myId}(you){/if}
            — {trainer.status}
            | distance: {trainer.routeProgress.totalDistance}
            | cost: {trainer.routeProgress.totalCost}/{trainer.bustThreshold}
            | score: {trainer.score}
          </div>
        {/each}
      </div>
    </section>
  {:else if gameState?.phase === 'world'}
    <section>
      <h2>World</h2>
      <p>Route {gameState.routeNumber} complete! Voting and marketplace coming soon...</p>
      <div class="other-trainers">
        <h3>Standings</h3>
        {#each trainerList as trainer}
          <div class="trainer-row" class:me={trainer.id === myId}>
            <strong>{trainer.name}</strong>
            {#if trainer.id === myId}(you){/if}
            — Score: {trainer.score} | Currency: {trainer.currency}
          </div>
        {/each}
      </div>
    </section>
  {/if}

  {#if events.length > 0}
    <section class="event-log">
      <h3>Events</h3>
      {#each events as event}
        <div class="event">{event.type} {JSON.stringify(event).slice(0, 120)}</div>
      {/each}
    </section>
  {/if}
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
  .my-turn {
    background: #f8f8f8;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }
  .drawn-creatures {
    margin-top: 0.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .creature {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
    border: 1px solid #aaa;
  }
  .creature.fire { background: #ffe0e0; }
  .creature.water { background: #e0e8ff; }
  .creature.earth { background: #e0ffe0; }
  .creature.air { background: #f0f0f0; }
  .creature.shadow { background: #e0d8f0; }
  .creature.light { background: #fffde0; }
  .trainer-row { padding: 0.25rem 0; font-size: 0.9rem; }
  .trainer-row.me { font-weight: bold; }
  .event-log { font-size: 0.8rem; }
  .event { padding: 0.15rem 0; color: #666; font-family: monospace; }
</style>
