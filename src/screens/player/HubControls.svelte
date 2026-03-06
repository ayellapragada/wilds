<script lang="ts">
  import type { PhoneViewState, Action } from '../../../engine/types';
  import { spriteUrl } from '../../lib/assets';

  let { gameState, send }: {
    gameState: PhoneViewState;
    send: (action: Action) => void;
  } = $props();

  let me = $derived(gameState.me);
  let trainerCount = $derived(1 + Object.keys(gameState.otherTrainers).length);
</script>

<section>
  <h2>Hub</h2>
  <p>Score: {me.score} | Currency: {me.currency}</p>

  {#if gameState.hub}
    {@const mySelections = gameState.hub.selections[me.id] ?? []}
    {@const isConfirmed = gameState.hub.confirmedTrainers.includes(me.id)}
    {@const myFreeOffers = gameState.hub.freePickOffers[me.id] ?? []}

    <p class="selection-status">{mySelections.length}/2 selected</p>

    <div class="shop-items">
      {#each myFreeOffers as pkmn}
        {@const selected = mySelections.includes(pkmn.id)}
        <button
          class="pokemon-card"
          class:selected
          onclick={() => send({ type: 'select_pokemon', trainerId: me.id, pokemonId: pkmn.id })}
          disabled={isConfirmed || (!selected && mySelections.length >= 2)}
        >
          <img class="sprite" src={spriteUrl(pkmn.templateId)} alt={pkmn.name} />
          <strong>{pkmn.name}</strong>
          <span class="stats">+{pkmn.distance}d / +{pkmn.cost}c</span>
          <span class="price free">FREE</span>
        </button>
      {/each}
      {#each gameState.hub.shopPokemon as pkmn}
        {@const price = gameState.hub.shopPrices[pkmn.id] ?? 0}
        {@const selected = mySelections.includes(pkmn.id)}
        <button
          class="pokemon-card"
          class:selected
          onclick={() => send({ type: 'select_pokemon', trainerId: me.id, pokemonId: pkmn.id })}
          disabled={isConfirmed || (!selected && (mySelections.length >= 2 || me.currency < price))}
        >
          <img class="sprite" src={spriteUrl(pkmn.templateId)} alt={pkmn.name} />
          <strong>{pkmn.name}</strong>
          <span class="stats">+{pkmn.distance}d / +{pkmn.cost}c</span>
          <span class="price">${price}</span>
        </button>
      {/each}
    </div>

    {#if isConfirmed}
      <p>Waiting for others... ({gameState.hub.confirmedTrainers.length}/{trainerCount})</p>
    {:else}
      <button class="confirm-btn" onclick={() => send({ type: 'confirm_selections', trainerId: me.id })}>
        Confirm ({mySelections.length}/2)
      </button>
    {/if}
  {/if}
</section>

<style>
  section { padding: 1rem; }
  .selection-status { font-size: 1.2em; font-weight: bold; }
  .shop-items { display: flex; flex-direction: column; gap: 0.75rem; margin: 1rem 0; }
  .sprite { width: 40px; height: 34px; image-rendering: pixelated; }
  .pokemon-card { display: flex; flex-direction: column; align-items: flex-start; gap: 0.25rem; padding: 0.75rem 1rem; border: 2px solid #ccc; border-radius: 8px; background: #fff; cursor: pointer; text-align: left; width: 100%; }
  .pokemon-card:hover { border-color: #888; }
  .pokemon-card:disabled { opacity: 0.4; cursor: default; }
  .pokemon-card.selected { border-color: gold; background: rgba(255, 215, 0, 0.1); }
  .stats { font-size: 0.85rem; color: #444; }
  .price { font-weight: bold; color: #c8a020; }
  .price.free { color: green; }
  .confirm-btn { margin-top: 1rem; padding: 0.75rem 2rem; font-size: 1.1rem; background: #4a90d9; color: white; border: none; border-radius: 8px; cursor: pointer; }
  .confirm-btn:hover { background: #3a7cc9; }
</style>
