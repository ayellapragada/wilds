<script lang="ts">
  import type { TVViewState, Action } from '../../../engine/types';
  import Lobby from './Lobby.svelte';
  import Route from './Route.svelte';
  import Hub from './Hub.svelte';
  import World from './World.svelte';
  import GameOver from './GameOver.svelte';

  let { gameState, send }: {
    gameState: TVViewState;
    send: (action: Action) => void;
  } = $props();
</script>

{#if gameState.phase === 'lobby'}
  <Lobby {gameState} {send} />
{:else if gameState.phase === 'route'}
  <Route {gameState} />
{:else if gameState.phase === 'hub'}
  <Hub {gameState} />
{:else if gameState.phase === 'world'}
  <World {gameState} />
{:else if gameState.phase === 'game_over'}
  <GameOver {gameState} />
{/if}
