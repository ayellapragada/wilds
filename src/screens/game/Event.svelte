<script lang="ts">
  import type { TVViewState, Action } from '../../../engine/types';
  import { copy } from '../../../copy';

  let { gameState, send }: {
    gameState: TVViewState;
    send: (action: Action) => void;
  } = $props();

  let event = $derived(gameState.event!);

  let countdown = $state(3);
  $effect(() => {
    const interval = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(interval);
        continueToRoute();
      }
    }, 1000);
  });

  function continueToRoute() {
    const firstTrainer = Object.keys(gameState.trainers)[0];
    send({ type: "continue_event", trainerId: firstTrainer });
  }
</script>

<section>
  <h2>{copy.eventAnnouncement}</h2>
  <div class="event-card">
    <h3 class="event-name">{event.name}</h3>
    <p class="event-desc">{event.description}</p>
  </div>
  <button class="continue-btn" onclick={continueToRoute}>
    {copy.continueButton} {#if countdown > 0}({countdown}){/if}
  </button>
</section>

<style>
  section { padding: var(--space-6); text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 50vh; }
  .event-card {
    margin: var(--space-8) 0;
    padding: var(--space-8);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-2xl);
    background: var(--color-bg-muted);
    max-width: 30rem;
    animation: event-appear 0.6s ease-out;
  }
  .event-name { font-size: var(--text-3xl); margin-bottom: var(--space-4); }
  .event-desc { font-size: var(--text-lg); color: var(--color-text-secondary); }
  .continue-btn {
    padding: var(--space-4) var(--space-8);
    font-size: var(--text-lg);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-xl);
    cursor: pointer;
  }
  @keyframes event-appear {
    from { transform: scale(0.8); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
</style>
