<script lang="ts">
  import type { TrailSpot } from '../../engine/types';
  import type { Snippet } from 'svelte';

  let { spot, highlighted = false, size = 52, children }: {
    spot: TrailSpot;
    highlighted?: boolean;
    size?: number;
    children?: Snippet;
  } = $props();
</script>

<div class="spot" class:highlighted style="width: {size}px; height: {size}px;">
  <span class="vp">{spot.vp}</span>
  <span class="currency">{spot.currency}c</span>
  {#if spot.item}
    <span class="item-indicator">{spot.item.hidden ? '?' : 'N'}</span>
  {/if}
  {#if children}
    {@render children()}
  {/if}
</div>

<style>
  .spot {
    border: 2px solid var(--color-trail-border);
    border-radius: var(--radius-md);
    background: var(--color-trail-bg);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .spot.highlighted { border-color: var(--color-primary); border-width: 3px; background: #d4eaff; }

  .vp {
    position: absolute;
    top: 2px;
    right: 4px;
    font-size: var(--text-xs);
    font-weight: bold;
    color: var(--color-trail-vp);
  }

  .currency {
    position: absolute;
    top: 2px;
    left: 4px;
    font-size: var(--text-xs);
    font-weight: bold;
    color: var(--color-gold-dark);
  }

  .item-indicator {
    position: absolute;
    bottom: 2px;
    right: 4px;
    font-size: var(--text-xs);
    font-weight: bold;
    color: var(--color-gold-indicator);
    background: var(--color-gold-indicator-bg);
    border-radius: var(--radius-sm);
    padding: 0 2px;
    line-height: 1;
  }
</style>
