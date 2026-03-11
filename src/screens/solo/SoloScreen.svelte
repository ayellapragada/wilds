<script lang="ts">
  import type { TVViewState, PhoneViewState, Action } from '../../../engine/types';
  import GameScreen from '../game/GameScreen.svelte';
  import HitOrStop from '../player/HitOrStop.svelte';
  import HubControls from '../player/HubControls.svelte';
  import WorldVote from '../player/WorldVote.svelte';
  import PhoneGameOver from '../player/PhoneGameOver.svelte';

  let { tvState, phoneState, send }: {
    tvState: TVViewState;
    phoneState: PhoneViewState;
    send: (action: Action) => void;
  } = $props();

</script>

<div class="solo-layout">
  <div class="tv-section">
    <GameScreen gameState={tvState} {send} />
  </div>

  {#if phoneState.phase !== 'lobby'}
    <div class="controls-section">
      {#if phoneState.phase === 'route'}
        <HitOrStop gameState={phoneState} {send} />
      {:else if phoneState.phase === 'hub'}
        <HubControls gameState={phoneState} {send} />
      {:else if phoneState.phase === 'world'}
        <WorldVote gameState={phoneState} {send} />
      {:else if phoneState.phase === 'game_over'}
        <PhoneGameOver gameState={phoneState} />
      {/if}
    </div>
  {/if}
</div>

<style>
  .solo-layout {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
  .controls-section {
    border-top: 2px solid var(--color-border);
    padding-top: var(--space-6);
  }
</style>
