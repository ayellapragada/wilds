<script lang="ts">
  import type { Pokemon } from '../../engine/types';
  import { spriteUrl, typeColor } from '../lib/assets';
  import { copy } from '../../copy';

  let { pokemon, highlighted = false, collapsed = false }: {
    pokemon: Pokemon;
    highlighted?: boolean;
    collapsed?: boolean;
  } = $props();

  let isCollapsed = $state(false);
  $effect(() => { isCollapsed = collapsed; });

  const RARITY_COLORS: Record<string, string> = {
    common: '#9e9e9e',
    uncommon: '#4caf50',
    rare: '#2196f3',
    legendary: '#ffc107',
  };

  let rarityColor = $derived(RARITY_COLORS[pokemon.rarity] ?? '#9e9e9e');
  let bgColor = $derived(typeColor(pokemon.types));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="card"
  class:highlighted
  class:collapsed={isCollapsed}
  style="border-color: {rarityColor}"
  onclick={() => isCollapsed = !isCollapsed}
>
  <div class="card-header" style="background: {bgColor}">
    <img class="sprite" src={spriteUrl(pokemon.templateId)} alt={pokemon.name} />
    <span class="name">{pokemon.name}</span>
    {#if isCollapsed}
      <span class="stat distance compact">+{pokemon.distance}{copy.distanceAbbr}</span>
      <span class="stat cost compact">+{pokemon.cost}{copy.costAbbr}</span>
    {/if}
    <span class="rarity-pip" style="background: {rarityColor}"></span>
  </div>

  {#if !isCollapsed}
    {#if pokemon.moves.length > 0}
      <div class="moves">
        {#each pokemon.moves as move}
          <div class="move">
            <span class="move-name">{move.name}</span>
            <span class="move-text">{move.reminderText}</span>
          </div>
        {/each}
      </div>
    {/if}

    <div class="stats">
      <span class="stat distance">+{pokemon.distance}{copy.distanceAbbr}</span>
      <span class="stat cost">+{pokemon.cost}{copy.costAbbr}</span>
    </div>
  {/if}
</div>

<style>
  .card {
    border: 2px solid var(--color-text-faint);
    border-radius: var(--radius-xl);
    overflow: hidden;
    background: var(--color-bg);
    width: 100%;
    cursor: pointer;
    display: flex;
    flex-direction: column;
  }
  .card.collapsed { height: auto; }
  .card.highlighted { box-shadow: var(--shadow-sm); }

  .card-header {
    display: flex;
    align-items: center;
    padding: 0.4rem var(--space-4);
    gap: 0.4rem;
  }
  .sprite {
    width: var(--sprite-width);
    height: var(--sprite-height);
    image-rendering: pixelated;
    flex-shrink: 0;
  }
  .name {
    flex: 1;
    font-weight: bold;
    font-size: var(--text-xl);
    color: rgba(0, 0, 0, 0.8);
  }
  .rarity-pip {
    width: var(--pip-size);
    height: var(--pip-size);
    border-radius: var(--radius-full);
    flex-shrink: 0;
    border: 1px solid rgba(0, 0, 0, 0.15);
  }

  .stats {
    display: flex;
    gap: var(--space-4);
    padding: 0.3rem var(--space-4);
    justify-content: center;
    border-top: 1px solid var(--color-border-lighter);
  }
  .stat {
    font-weight: 600;
    font-size: 0.95rem;
    padding: var(--space-1) var(--space-4);
    border-radius: var(--radius-xs);
  }
  .stat.compact {
    font-size: var(--text-sm);
    padding: 0.1rem var(--space-3);
  }
  .distance { background: var(--color-distance-bg); color: var(--color-distance-text); }
  .cost { background: var(--color-cost-bg); color: var(--color-cost-text); }

  .moves {
    padding: var(--space-2) var(--space-4) 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;

    flex: 1;
    overflow-y: auto;
  }
  .move {
    font-size: var(--text-base);
    line-height: 1.3;
  }
  .move-name {
    font-weight: 600;
    color: var(--color-text);
  }
  .move-text {
    color: var(--color-text-muted);
    margin-left: var(--space-2);
  }
</style>
