<script lang="ts">
  import type { PhoneViewState, Action } from '../../../engine/types';
  import JoinScreen from './JoinScreen.svelte';
  import LobbyWait from './LobbyWait.svelte';
  import HitOrStop from './HitOrStop.svelte';
  import HubControls from './HubControls.svelte';
  import WorldVote from './WorldVote.svelte';
  import PhoneGameOver from './PhoneGameOver.svelte';
  import RestStopControls from './RestStopControls.svelte';

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
{:else if gameState.phase === 'event'}
  <section style="padding: var(--space-6); text-align: center; min-height: 50vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
    {#if gameState.event}
      <h3>{gameState.event.name}</h3>
      <p>{gameState.event.description}</p>
    {:else}
      <p>Event incoming...</p>
    {/if}
  </section>
{:else if gameState.phase === 'rest_stop'}
  <RestStopControls {gameState} {send} />
{:else if gameState.phase === 'game_over'}
  <PhoneGameOver {gameState} {send} />
{/if}
