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
    <div class="stats">
      <span class="stat distance">+{pokemon.distance}{copy.distanceAbbr}</span>
      <span class="stat cost">+{pokemon.cost}{copy.costAbbr}</span>
    </div>

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
  {/if}
</div>

<style>
  .card {
    border: 2px solid #9e9e9e;
    border-radius: 10px;
    overflow: hidden;
    background: #fff;
    width: 100%;
    cursor: pointer;
    height: 11.25rem;
    display: flex;
    flex-direction: column;
  }
  .card.collapsed {
    height: auto;
  }
  .card.highlighted {
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.25);
  }

  .card-header {
    display: flex;
    align-items: center;
    padding: 0.4rem 0.5rem;
    gap: 0.4rem;
  }
  .sprite {
    width: 48px;
    height: 40px;
    image-rendering: pixelated;
    flex-shrink: 0;
  }
  .name {
    flex: 1;
    font-weight: bold;
    font-size: 1.1rem;
    color: rgba(0, 0, 0, 0.8);
  }
  .rarity-pip {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 1px solid rgba(0, 0, 0, 0.15);
  }

  .stats {
    display: flex;
    gap: 0.5rem;
    padding: 0.3rem 0.5rem;
    justify-content: center;
  }
  .stat {
    font-weight: 600;
    font-size: 0.95rem;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }
  .stat.compact {
    font-size: 0.75rem;
    padding: 0.1rem 0.35rem;
  }
  .distance { background: #e8f5e9; color: #2e7d32; }
  .cost { background: #fce4ec; color: #c62828; }

  .moves {
    padding: 0.25rem 0.5rem 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    border-top: 1px solid #eee;
    flex: 1;
    overflow-y: auto;
  }
  .move {
    font-size: 0.85rem;
    line-height: 1.3;
  }
  .move-name {
    font-weight: 600;
    color: #333;
  }
  .move-text {
    color: #666;
    margin-left: 0.25rem;
  }
</style>
