<script lang="ts">
  import type { GameState, Action, Trainer } from '../../../engine/types';
  import { spriteUrl } from '../../lib/assets';

  let { gameState, myId, send }: {
    gameState: GameState;
    myId: string;
    send: (action: Action) => void;
  } = $props();

  let myTrainer = $derived(gameState.trainers[myId] ?? null);
  let trainerList = $derived(Object.values(gameState.trainers) as Trainer[]);
  let trainerCount = $derived(Object.keys(gameState.trainers).length);
</script>

<section>
  <h2>Hub</h2>
  <p>Score: {myTrainer?.score} | Currency: {myTrainer?.currency}</p>

  {#if gameState.hub}
    {@const mySelections = gameState.hub.selections[myId] ?? []}
    {@const isConfirmed = gameState.hub.confirmedTrainers.includes(myId)}
    {@const myFreeOffers = gameState.hub.freePickOffers[myId] ?? []}

    <h3>Shop</h3>
    <p class="selection-status">{mySelections.length}/2 selected</p>

    <div class="shop-items">
      {#each myFreeOffers as pkmn}
        {@const selected = mySelections.includes(pkmn.id)}
        <button
          class="pokemon-card {pkmn.types[0]}"
          class:selected
          onclick={() => send({ type: 'select_pokemon', trainerId: myId, pokemonId: pkmn.id })}
          disabled={isConfirmed || (!selected && mySelections.length >= 2)}
        >
          <img class="sprite" src={spriteUrl(pkmn.templateId)} alt={pkmn.name} />
          <strong>{pkmn.name}</strong>
          <span class="pokemon-stats">+{pkmn.distance}d / +{pkmn.cost}c</span>
          <span class="pokemon-rarity">{pkmn.rarity}</span>
          <span class="pokemon-price free">FREE</span>
          {#if pkmn.description}
            <span class="pokemon-desc">{pkmn.description}</span>
          {/if}
        </button>
      {/each}
      {#each gameState.hub.shopPokemon as pkmn}
        {@const price = gameState.hub.shopPrices[pkmn.id] ?? 0}
        {@const selected = mySelections.includes(pkmn.id)}
        <button
          class="pokemon-card {pkmn.types[0]}"
          class:selected
          onclick={() => send({ type: 'select_pokemon', trainerId: myId, pokemonId: pkmn.id })}
          disabled={isConfirmed || (!selected && (mySelections.length >= 2 || (myTrainer?.currency ?? 0) < price))}
        >
          <img class="sprite" src={spriteUrl(pkmn.templateId)} alt={pkmn.name} />
          <strong>{pkmn.name}</strong>
          <span class="pokemon-stats">+{pkmn.distance}d / +{pkmn.cost}c</span>
          <span class="pokemon-rarity">{pkmn.rarity}</span>
          <span class="pokemon-price">${price}</span>
          {#if pkmn.description}
            <span class="pokemon-desc">{pkmn.description}</span>
          {/if}
        </button>
      {/each}
    </div>

    {#if isConfirmed}
      <p>Waiting for others... ({gameState.hub.confirmedTrainers.length}/{trainerCount} confirmed)</p>
    {:else}
      <button class="ready-btn" onclick={() => send({ type: 'confirm_selections', trainerId: myId })}>
        Confirm ({mySelections.length}/2 selected)
      </button>
    {/if}
  {/if}

  <div class="other-trainers">
    <h3>Trainers</h3>
    {#each trainerList as trainer}
      <div class="trainer-row" class:me={trainer.id === myId}>
        <strong>{trainer.name}</strong>
        {#if trainer.id === myId}(you){/if}
        — Score: {trainer.score} | Currency: {trainer.currency}
        {#if gameState.hub?.confirmedTrainers.includes(trainer.id)}
          <span class="voted-badge">confirmed</span>
        {/if}
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
  .shop-items {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 1rem 0;
  }
  .sprite { width: 40px; height: 34px; image-rendering: pixelated; }
  .pokemon-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
    padding: 0.75rem 1rem;
    border: 2px solid #ccc;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    text-align: left;
    width: 100%;
  }
  .pokemon-card:hover { border-color: #888; background: #f8f8f8; }
  .pokemon-card:disabled { opacity: 0.4; cursor: default; }
  .pokemon-card.normal { border-color: #c0c0b8; }
  .pokemon-card.fire { border-color: #e8a0a0; }
  .pokemon-card.water { border-color: #a0b8e8; }
  .pokemon-card.grass { border-color: #a0e8a0; }
  .pokemon-card.electric { border-color: #d8d0a0; }
  .pokemon-card.ice { border-color: #a0d0e8; }
  .pokemon-card.fighting { border-color: #d0a8a0; }
  .pokemon-card.poison { border-color: #c0a8d0; }
  .pokemon-card.ground { border-color: #d0c0a0; }
  .pokemon-card.flying { border-color: #c0b8d0; }
  .pokemon-card.psychic { border-color: #e0a8c0; }
  .pokemon-card.bug { border-color: #c0d0a0; }
  .pokemon-card.rock { border-color: #c0b8a0; }
  .pokemon-card.ghost { border-color: #b0a8c0; }
  .pokemon-card.dragon { border-color: #a0a0d0; }
  .pokemon-card.dark { border-color: #b0a8a0; }
  .pokemon-card.steel { border-color: #b8b8c0; }
  .pokemon-card.fairy { border-color: #e0c0d0; }
  .pokemon-card.selected {
    border-color: gold;
    background: rgba(255, 215, 0, 0.1);
    box-shadow: 0 0 8px rgba(255, 215, 0, 0.3);
  }
  .pokemon-stats { font-size: 0.85rem; color: #444; }
  .pokemon-rarity {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #888;
  }
  .pokemon-price {
    font-weight: bold;
    color: #c8a020;
  }
  .pokemon-price.free {
    color: green;
    font-weight: bold;
  }
  .pokemon-desc {
    font-size: 0.8rem;
    color: #666;
    font-style: italic;
  }
  .selection-status {
    font-size: 1.2em;
    font-weight: bold;
  }
  .ready-btn {
    margin-top: 1rem;
    padding: 0.75rem 2rem;
    font-size: 1.1rem;
    background: #4a90d9;
    color: white;
    border: none;
    border-radius: 8px;
  }
  .ready-btn:hover { background: #3a7cc9; }
  .trainer-row { padding: 0.25rem 0; font-size: 0.9rem; }
  .trainer-row.me { font-weight: bold; }
  .voted-badge {
    font-size: 0.75rem;
    background: #e0ffe0;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    color: #2a7a2a;
    margin-left: 0.25rem;
  }
</style>
