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
          <div class="card-info">
            <strong>{pkmn.name}</strong>
            <span class="pokemon-stats">+{pkmn.distance}{copy.distanceAbbr} / +{pkmn.cost}{copy.costAbbr}</span>
          </div>
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
  section { margin-bottom: 1rem; padding: 0.5rem; border: 1px solid #ccc; border-radius: 0.4rem; }
  .shop-items { display: flex; flex-direction: column; gap: 0.4rem; margin: 0.5rem 0; }
  .sprite { width: 2rem; height: 1.7rem; image-rendering: pixelated; flex-shrink: 0; }
  .pokemon-card { display: flex; flex-direction: row; align-items: center; gap: 0.4rem; padding: 0.4rem 0.6rem; border: 2px solid #ccc; border-radius: 0.4rem; background: #fff; font-size: 0.8rem; }
  .card-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .card-info strong { font-size: 0.8rem; }
  .pokemon-stats { font-size: 0.7rem; color: #444; }
  .pokemon-price { font-weight: bold; color: #c8a020; font-size: 0.8rem; flex-shrink: 0; }
  .trainer-row { padding: 0.15rem 0; font-size: 0.8rem; }
  .badge { font-size: 0.65rem; background: #e0ffe0; padding: 0.1rem 0.3rem; border-radius: 0.25rem; color: #2a7a2a; margin-left: 0.25rem; }
  h2, h3 { font-size: 0.9rem; margin: 0.25rem 0; }
</style>
