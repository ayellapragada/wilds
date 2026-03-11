<script lang="ts">
  import type { TVViewState, Action } from '../../../engine/types';
  import Lobby from './Lobby.svelte';
  import Route from './Route.svelte';
  import Hub from './Hub.svelte';
  import World from './World.svelte';
  import GameOver from './GameOver.svelte';
  import PhaseTransition from './PhaseTransition.svelte';
  import Event from './Event.svelte';
  import { copy } from '../../../copy';

  let { gameState, send }: {
    gameState: TVViewState;
    send: (action: Action) => void;
  } = $props();

  const TRANSITION_DURATION_MS = 1500;
  let transitionText = $state<string | null>(null);
  let prevPhase = $state(gameState.phase);
  let transitionTimer: ReturnType<typeof setTimeout> | null = null;

  const transitionMessages: Record<string, string> = {
    hub: copy.transitionHub,
    world: copy.transitionWorld,
    route: copy.transitionRoute,
    game_over: copy.transitionGameOver,
  };

  $effect(() => {
    if (gameState.phase !== prevPhase) {
      const msg = transitionMessages[gameState.phase];
      if (msg && prevPhase !== 'lobby') {
        transitionText = msg;
        if (transitionTimer) clearTimeout(transitionTimer);
        transitionTimer = setTimeout(() => {
          transitionText = null;
          transitionTimer = null;
        }, TRANSITION_DURATION_MS);
      }
      prevPhase = gameState.phase;
    }
  });
</script>

{#if transitionText}
  <PhaseTransition text={transitionText} />
{:else if gameState.phase === 'lobby'}
  <Lobby {gameState} {send} />
{:else if gameState.phase === 'event'}
  <Event {gameState} {send} />
{:else if gameState.phase === 'rest_stop'}
  <section style="padding: var(--space-6); text-align: center; min-height: 50vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
    <h2>{copy.restStop}</h2>
    <p>{copy.waitingForOthers}</p>
  </section>
{:else if gameState.phase === 'route'}
  <Route {gameState} />
{:else if gameState.phase === 'hub'}
  <Hub {gameState} />
{:else if gameState.phase === 'world'}
  <World {gameState} />
{:else if gameState.phase === 'game_over'}
  <GameOver {gameState} />
{/if}
