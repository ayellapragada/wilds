<script lang="ts">
  import type { GameState, Action } from '../../../engine/types';

  let { gameState, myId, send }: {
    gameState: GameState;
    myId: string;
    send: (action: Action) => void;
  } = $props();
</script>

<main>
  <h1>Wilds</h1>
  <p>Player controller coming soon.</p>
  <p>Phase: {gameState.phase}</p>
</main>

<style>
  main {
    font-family: system-ui, sans-serif;
    max-width: 600px;
    margin: 0 auto;
    padding: 1rem;
    text-align: center;
  }
</style>
