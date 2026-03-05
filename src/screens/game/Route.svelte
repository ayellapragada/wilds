<script lang="ts">
  import type { GameState, Action, Trainer } from '../../../engine/types';

  let { gameState, myId, send }: {
    gameState: GameState;
    myId: string;
    send: (action: Action) => void;
  } = $props();

  let myTrainer = $derived(gameState.trainers[myId] ?? null);
  let trainerList = $derived(Object.values(gameState.trainers) as Trainer[]);

  function hit() {
    send({ type: 'hit', trainerId: myId });
  }

  function stop() {
    send({ type: 'stop', trainerId: myId });
  }

  function choosePenalty(choice: 'keep_score' | 'keep_currency') {
    send({ type: 'choose_bust_penalty', trainerId: myId, choice });
  }
</script>

<section>
  <h2>Route {gameState.routeNumber} — {gameState.currentRoute?.name}</h2>

  {#if myTrainer}
    <div class="my-turn">
      <h3>Your Turn</h3>
      <p>
        Distance: <strong>{myTrainer.routeProgress.totalDistance}</strong> |
        Cost: <strong>{myTrainer.routeProgress.totalCost}</strong> / {myTrainer.bustThreshold} |
        Pokemon drawn: {myTrainer.routeProgress.pokemonDrawn}
      </p>
      <p>Score: {myTrainer.score} | Currency: {myTrainer.currency}</p>

      {#if myTrainer.status === 'exploring'}
        <button onclick={hit}>HIT</button>
        <button onclick={stop} disabled={myTrainer.routeProgress.pokemonDrawn === 0}>STOP</button>
      {:else if myTrainer.status === 'busted'}
        <p><strong>Whited Out!</strong> Cost {myTrainer.routeProgress.totalCost} exceeded threshold {myTrainer.bustThreshold}.</p>
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
        <div class="drawn-pokemon">
          <h4>Drawn this route:</h4>
          {#each myTrainer.deck.drawn as pkmn}
            <span class="pokemon {pkmn.types[0]}" title={pkmn.description}>
              {pkmn.name} (+{pkmn.distance}d / +{pkmn.cost}c)
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

<style>
  section {
    margin-bottom: 1.5rem;
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 8px;
  }
  .my-turn {
    background: #f8f8f8;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }
  .drawn-pokemon {
    margin-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .pokemon {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
    border: 1px solid #aaa;
  }
  .pokemon.normal { background: #f0f0e8; }
  .pokemon.fire { background: #ffe0e0; }
  .pokemon.water { background: #e0e8ff; }
  .pokemon.grass { background: #e0ffe0; }
  .pokemon.electric { background: #fff8d0; }
  .pokemon.ice { background: #e0f8ff; }
  .pokemon.fighting { background: #f0d8d0; }
  .pokemon.poison { background: #e8d8f0; }
  .pokemon.ground { background: #f0e8d0; }
  .pokemon.flying { background: #e8e0f8; }
  .pokemon.psychic { background: #ffe0f0; }
  .pokemon.bug { background: #e8f0d0; }
  .pokemon.rock { background: #e8e0d0; }
  .pokemon.ghost { background: #d8d0e8; }
  .pokemon.dragon { background: #d0d0f8; }
  .pokemon.dark { background: #d8d0c8; }
  .pokemon.steel { background: #e0e0e8; }
  .pokemon.fairy { background: #ffe8f0; }
  .trainer-row { padding: 0.25rem 0; font-size: 0.9rem; }
  .trainer-row.me { font-weight: bold; }
</style>
