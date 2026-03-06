<script lang="ts">
  import type { TVViewState, TrainerPublicInfo } from '../../../engine/types';
  import { spriteUrl } from '../../lib/assets';
  import { copy } from '../../../copy';

  let { gameState }: {
    gameState: TVViewState;
  } = $props();

  let trainerList = $derived(Object.values(gameState.trainers) as TrainerPublicInfo[]);
  let trainerCount = $derived(Object.keys(gameState.trainers).length);
</script>

<section>
  <h2>{copy.hub}</h2>

  {#if gameState.hub}
    <h3>{copy.shop}</h3>
    <div class="shop-items">
      {#each gameState.hub.shopPokemon as pkmn}
        {@const price = gameState.hub.shopPrices[pkmn.id] ?? 0}
        <div class="pokemon-card {pkmn.types[0]}">
          <img class="sprite" src={spriteUrl(pkmn.templateId)} alt={pkmn.name} />
          <strong>{pkmn.name}</strong>
          <span class="pokemon-stats">+{pkmn.distance}{copy.distanceAbbr} / +{pkmn.cost}{copy.costAbbr}</span>
          <span class="pokemon-price">${price}</span>
        </div>
      {/each}
    </div>
    <p>{gameState.hub.confirmedTrainers.length}/{trainerCount} {copy.confirmed}</p>
  {/if}

  <div class="trainers">
    <h3>{copy.trainers}</h3>
    {#each trainerList as trainer}
      <div class="trainer-row">
        <strong>{trainer.name}</strong>
        — {copy.score}: {trainer.score} | {copy.currency}: {trainer.currency}
        {#if gameState.hub?.confirmedTrainers.includes(trainer.id)}
          <span class="badge">{copy.confirmed}</span>
        {/if}
      </div>
    {/each}
  </div>
</section>

<style>
  section { margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #ccc; border-radius: 8px; }
  .shop-items { display: flex; flex-direction: column; gap: 0.75rem; margin: 1rem 0; }
  .sprite { width: 40px; height: 34px; image-rendering: pixelated; }
  .pokemon-card { display: flex; flex-direction: column; align-items: flex-start; gap: 0.25rem; padding: 0.75rem 1rem; border: 2px solid #ccc; border-radius: 8px; background: #fff; }
  .pokemon-stats { font-size: 0.85rem; color: #444; }
  .pokemon-price { font-weight: bold; color: #c8a020; }
  .trainer-row { padding: 0.25rem 0; font-size: 0.9rem; }
  .badge { font-size: 0.75rem; background: #e0ffe0; padding: 0.1rem 0.4rem; border-radius: 4px; color: #2a7a2a; margin-left: 0.25rem; }
</style>
