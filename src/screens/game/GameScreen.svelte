<script lang="ts">
  import type { GameState, Action } from '../../../engine/types';
  import Lobby from './Lobby.svelte';
  import Route from './Route.svelte';
  import Hub from './Hub.svelte';
  import World from './World.svelte';

  let { gameState, myId = $bindable(), send }: {
    gameState: GameState;
    myId: string;
    send: (action: Action) => void;
  } = $props();

  function handleJoin(id: string) {
    myId = id;
  }
</script>

{#if gameState.phase === 'lobby'}
  <Lobby {gameState} {myId} {send} onJoin={handleJoin} />
{:else if gameState.phase === 'route'}
  <Route {gameState} {myId} {send} />
{:else if gameState.phase === 'hub'}
  <Hub {gameState} {myId} {send} />
{:else if gameState.phase === 'world'}
  <World {gameState} {myId} {send} />
{/if}
