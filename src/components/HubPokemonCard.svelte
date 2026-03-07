<script lang="ts">
  import type { Pokemon } from '../../engine/types';
  import { spriteUrl } from '../lib/assets';
  import { copy } from '../../copy';

  let { pokemon, priceLabel, selected = false, expanded = false, disabled = false, onToggleExpand, onToggleSelect }: {
    pokemon: Pokemon;
    priceLabel: string;
    selected?: boolean;
    expanded?: boolean;
    disabled?: boolean;
    onToggleExpand: () => void;
    onToggleSelect: () => void;
  } = $props();
</script>

<div class="pokemon-card" class:selected class:expanded>
  <button class="card-row" onclick={onToggleExpand}>
    <img class="sprite" src={spriteUrl(pokemon.templateId)} alt={pokemon.name} />
    <div class="card-info">
      <strong>{pokemon.name}</strong>
      <span class="stats">+{pokemon.distance}{copy.distanceAbbr} / +{pokemon.cost}{copy.costAbbr}</span>
    </div>
    <span class="price" class:free={priceLabel === copy.free}>{priceLabel}</span>
    <span class="chevron">{expanded ? '▲' : '▼'}</span>
  </button>
  {#if expanded}
    <div class="details">
      <div class="detail-row">
        <span class="types">{pokemon.types.join(' / ')}</span>
        <span class="rarity {pokemon.rarity}">{pokemon.rarity}</span>
      </div>
      {#if pokemon.description}
        <p class="description">{pokemon.description}</p>
      {/if}
      {#each pokemon.moves as move}
        <div class="move">
          <strong>{move.name}</strong>
          <span>{move.reminderText}</span>
        </div>
      {/each}
      <button
        class="select-btn"
        class:selected
        {disabled}
        onclick={onToggleSelect}
      >
        {selected ? '✓ Selected' : 'Select'}
      </button>
    </div>
  {/if}
</div>

<style>
  .pokemon-card { border: 2px solid var(--color-border); border-radius: 0.4rem; background: var(--color-bg); overflow: hidden; }
  .pokemon-card.selected { border-color: gold; background: rgba(255, 215, 0, 0.1); }

  .card-row { display: flex; flex-direction: row; align-items: center; gap: 0.4rem; padding: 0.4rem 0.6rem; cursor: pointer; text-align: left; width: 100%; font-size: var(--text-body); background: none; border: none; font: inherit; color: inherit; }
  .card-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .card-info strong { font-size: var(--text-body); }
  .stats { font-size: var(--text-detail); color: var(--color-text-secondary); }
  .price { font-weight: bold; color: var(--color-gold); font-size: var(--text-body); flex-shrink: 0; }
  .price.free { color: green; }
  .chevron { font-size: 0.6rem; color: var(--color-text-faint); flex-shrink: 0; }
  .sprite { width: 2rem; height: 1.7rem; image-rendering: pixelated; flex-shrink: 0; }

  .details { padding: 0.3rem 0.6rem var(--space-4); border-top: 1px solid var(--color-border-lighter); font-size: var(--text-sm); }
  .detail-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem; }
  .types { text-transform: capitalize; color: var(--color-text-secondary); }
  .rarity { text-transform: capitalize; font-weight: bold; font-size: var(--text-xs); padding: 0.1rem 0.3rem; border-radius: 0.2rem; }
  .rarity.common { color: var(--color-text-muted); background: var(--color-bg-hover); }
  .rarity.uncommon { color: var(--color-success-confirmed); background: var(--color-success-confirmed-bg); }
  .rarity.rare { color: var(--color-primary-dark); background: #ddeeff; }
  .rarity.legendary { color: #aa6a00; background: var(--color-gold-bg); }
  .description { margin: 0.2rem 0; color: var(--color-text-secondary); font-style: italic; }
  .move { margin: var(--space-1) 0; }
  .move strong { font-size: var(--text-detail); }
  .move span { font-size: var(--text-xs); color: var(--color-text-muted); margin-left: 0.2rem; }

  .select-btn { margin-top: 0.3rem; padding: 0.3rem 0.8rem; font-size: var(--text-sm); background: var(--color-bg-muted); border: 1px solid var(--color-border); border-radius: 0.3rem; cursor: pointer; width: 100%; }
  .select-btn.selected { background: rgba(255, 215, 0, 0.2); border-color: gold; font-weight: bold; }
  .select-btn:disabled { opacity: 0.4; cursor: default; }
</style>
