<script lang="ts">
  import type { PhoneViewState, Action } from '../../../engine/types';
  import JoinScreen from './JoinScreen.svelte';
  import LobbyWait from './LobbyWait.svelte';
  import HitOrStop from './HitOrStop.svelte';
  import HubControls from './HubControls.svelte';
  import WorldVote from './WorldVote.svelte';
  import PhoneGameOver from './PhoneGameOver.svelte';

  let { gameState, send, onJoin }: {
    gameState: PhoneViewState;
    send: (action: Action) => void;
    onJoin: (token: string) => void;
  } = $props();

  let hasJoined = $derived(!!gameState.me);
</script>

{#if !hasJoined}
  <JoinScreen roomCode={gameState.roomCode} {send} {onJoin} />
{:else if gameState.phase === 'lobby'}
  <LobbyWait {gameState} {send} />
{:else if gameState.phase === 'route'}
  <HitOrStop {gameState} {send} />
{:else if gameState.phase === 'hub'}
  <HubControls {gameState} {send} />
{:else if gameState.phase === 'world'}
  <WorldVote {gameState} {send} />
{:else if gameState.phase === 'game_over'}
  <PhoneGameOver {gameState} />
{/if}
