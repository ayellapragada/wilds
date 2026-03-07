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
  {#if children}
    {@render children()}
  {/if}
</div>

<style>
  .spot {
    /* width/height set via inline style */
    border: 2px solid #8b9b6b;
    border-radius: 6px;
    background: #c8e6a0;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .spot.highlighted { border-color: #4a90d9; border-width: 3px; background: #d4eaff; }

  .vp {
    position: absolute;
    top: 2px;
    right: 4px;
    font-size: 0.6rem;
    font-weight: bold;
    color: #4a6a2a;
  }

  .currency {
    position: absolute;
    top: 2px;
    left: 4px;
    font-size: 0.6rem;
    font-weight: bold;
    color: #b8860b;
  }
</style>
