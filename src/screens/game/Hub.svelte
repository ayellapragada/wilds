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
  section { margin-bottom: var(--space-6); padding: var(--space-4); border: 1px solid var(--color-border); border-radius: 0.4rem; }
  .shop-items { display: flex; flex-direction: column; gap: 0.4rem; margin: var(--space-4) 0; }
  .sprite { width: 2rem; height: 1.7rem; image-rendering: pixelated; flex-shrink: 0; }
  .pokemon-card { display: flex; flex-direction: row; align-items: center; gap: 0.4rem; padding: 0.4rem 0.6rem; border: 2px solid var(--color-border); border-radius: 0.4rem; background: var(--color-bg); font-size: var(--text-body); }
  .card-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .card-info strong { font-size: var(--text-body); }
  .pokemon-stats { font-size: var(--text-detail); color: var(--color-text-secondary); }
  .pokemon-price { font-weight: bold; color: var(--color-gold); font-size: var(--text-body); flex-shrink: 0; }
  .trainer-row { padding: var(--space-1) 0; font-size: var(--text-body); }
  .badge { font-size: var(--text-xs); background: var(--color-success-confirmed-bg); padding: 0.1rem 0.3rem; border-radius: var(--space-2); color: var(--color-success-confirmed); margin-left: var(--space-2); }
  h2, h3 { font-size: var(--text-md); margin: var(--space-2) 0; }
</style>
