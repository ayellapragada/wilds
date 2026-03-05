<script lang="ts">
  import { createConnection, type ServerMessage } from './lib/connection';
  import type { GameState, Action, Player } from '../engine/types';

  let gameState = $state<GameState | null>(null);
  let events: any[] = $state([]);
  let connected = $state(false);
  let roomCode = $state('test');
  let playerName = $state('');
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
    if (!playerName) return;
    const token = crypto.randomUUID().slice(0, 8);
    myId = token;
    send({ type: 'join_game', playerName, sessionToken: token });
  }

  function startGame() {
    send({ type: 'start_game', playerId: myId });
  }

  function drawCard() {
    send({ type: 'draw_card', playerId: myId });
  }

  function stopTurn() {
    send({ type: 'stop_turn', playerId: myId });
  }

  function choosePenalty(choice: 'keep_score' | 'keep_currency') {
    send({ type: 'choose_bust_penalty', playerId: myId, choice });
  }

  let myPlayer = $derived(gameState?.players[myId] ?? null);
  let playerList = $derived(gameState ? Object.values(gameState.players) as Player[] : [] as Player[]);
</script>

<main>
  <h1>Wilds</h1>

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
      {#if playerList.length > 0}
        <p>Players: {playerList.map(p => p.name).join(', ')}</p>
      {:else}
        <p>No players yet.</p>
      {/if}
      <input bind:value={playerName} placeholder="Your name" />
      <button onclick={join} disabled={!playerName}>Join</button>
    </section>
  {:else if gameState?.phase === 'lobby'}
    <section>
      <h2>Lobby — {roomCode}</h2>
      <p>Players: {playerList.map(p => p.name).join(', ')}</p>
      <p>You are: <strong>{myPlayer?.name}</strong></p>
      <button onclick={startGame} disabled={playerList.length < 1}>Start Game</button>
    </section>
  {:else if gameState?.phase === 'encounter'}
    <section>
      <h2>Encounter — Round {gameState.roundNumber}</h2>

      {#if myPlayer}
        <div class="my-turn">
          <h3>Your Turn</h3>
          <p>
            Distance: <strong>{myPlayer.turnState.totalDistance}</strong> |
            Cost: <strong>{myPlayer.turnState.totalCost}</strong> / {myPlayer.bustThreshold} |
            Cards drawn: {myPlayer.turnState.cardsDrawn}
          </p>
          <p>Score: {myPlayer.score} | Currency: {myPlayer.currency}</p>

          {#if myPlayer.status === 'active'}
            <button onclick={drawCard}>Draw Card</button>
            <button onclick={stopTurn} disabled={myPlayer.turnState.cardsDrawn === 0}>Stop</button>
          {:else if myPlayer.status === 'busted'}
            <p><strong>BUSTED!</strong> Cost {myPlayer.turnState.totalCost} exceeded threshold {myPlayer.bustThreshold}.</p>
            <p>Choose one to keep:</p>
            <button onclick={() => choosePenalty('keep_score')}>
              Keep Score (+{myPlayer.turnState.totalDistance} distance)
            </button>
            <button onclick={() => choosePenalty('keep_currency')}>
              Keep Currency (+{Math.floor(myPlayer.turnState.totalDistance / 3)} currency)
            </button>
          {:else if myPlayer.status === 'stopped'}
            <p>Waiting for other players...</p>
          {/if}

          {#if myPlayer.deck.drawn.length > 0}
            <div class="drawn-cards">
              <h4>Drawn this turn:</h4>
              {#each myPlayer.deck.drawn as card}
                <span class="card {card.type}" title={card.description}>
                  {card.name} (+{card.distance}d / +{card.cost}c)
                </span>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <div class="other-players">
        <h3>All Players</h3>
        {#each playerList as player}
          <div class="player-row" class:me={player.id === myId}>
            <strong>{player.name}</strong>
            {#if player.id === myId}(you){/if}
            — {player.status}
            | distance: {player.turnState.totalDistance}
            | cost: {player.turnState.totalCost}/{player.bustThreshold}
            | score: {player.score}
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
  .drawn-cards {
    margin-top: 0.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .card {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
    border: 1px solid #aaa;
  }
  .card.fire { background: #ffe0e0; }
  .card.water { background: #e0e8ff; }
  .card.earth { background: #e0ffe0; }
  .card.air { background: #f0f0f0; }
  .card.shadow { background: #e0d8f0; }
  .card.light { background: #fffde0; }
  .player-row { padding: 0.25rem 0; font-size: 0.9rem; }
  .player-row.me { font-weight: bold; }
  .event-log { font-size: 0.8rem; }
  .event { padding: 0.15rem 0; color: #666; font-family: monospace; }
</style>
