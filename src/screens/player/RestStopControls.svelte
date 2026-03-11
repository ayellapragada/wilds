<script lang="ts">
  import type { PhoneViewState, Action } from '../../../engine/types';
  import { copy } from '../../../copy';
  import PokemonCard from '../../components/PokemonCard.svelte';

  let { gameState, send }: {
    gameState: PhoneViewState;
    send: (action: Action) => void;
  } = $props();

  let me = $derived(gameState.me);
  let hasChosen = $state(false);
  let showRemoveList = $state(false);

  let allDeckCards = $derived([
    ...me.deck.drawPile,
    ...me.deck.drawn,
    ...me.deck.discard,
  ]);

  function chooseRemove(pokemonId: string) {
    send({ type: "rest_stop_choice", trainerId: me.id, choice: "remove", pokemonId });
    hasChosen = true;
  }

  function chooseScout() {
    send({ type: "rest_stop_choice", trainerId: me.id, choice: "scout" });
    hasChosen = true;
  }

  function chooseReinforce() {
    send({ type: "rest_stop_choice", trainerId: me.id, choice: "reinforce" });
    hasChosen = true;
  }
</script>

<section>
  <h2>{copy.restStop}</h2>

  {#if hasChosen}
    <p>{copy.waitingForOthers}</p>
  {:else if showRemoveList}
    <p>Choose a Pokémon to remove:</p>
    <div class="card-list">
      {#each allDeckCards as pkmn}
        <button class="remove-option" onclick={() => chooseRemove(pkmn.id)}>
          <PokemonCard pokemon={pkmn} />
        </button>
      {/each}
    </div>
    <button onclick={() => showRemoveList = false}>Back</button>
  {:else}
    <p>{copy.restStopPrompt}</p>
    <div class="choices">
      <button class="choice-btn" onclick={() => showRemoveList = true}>
        <strong>{copy.removeCard}</strong>
        <span>{copy.removeCardDesc}</span>
      </button>
      <button class="choice-btn" onclick={chooseScout}>
        <strong>{copy.scoutAhead}</strong>
        <span>{copy.scoutAheadDesc}</span>
      </button>
      <button class="choice-btn" onclick={chooseReinforce}>
        <strong>{copy.reinforce}</strong>
        <span>{copy.reinforceDesc}</span>
      </button>
    </div>
  {/if}
</section>

<style>
  section { padding: var(--space-6); text-align: center; }
  .choices { display: flex; flex-direction: column; gap: var(--space-4); margin: var(--space-6) 0; }
  .choice-btn {
    display: flex; flex-direction: column; gap: var(--space-2);
    padding: var(--space-5); border: 2px solid var(--color-border);
    border-radius: var(--radius-lg); background: var(--color-bg); cursor: pointer;
    text-align: left;
  }
  .choice-btn:hover { border-color: var(--color-primary); background: var(--color-bg-muted); }
  .choice-btn span { font-size: var(--text-sm); color: var(--color-text-secondary); }
  .card-list { display: flex; flex-direction: column; gap: var(--space-3); margin: var(--space-4) 0; }
  .remove-option { background: none; border: none; cursor: pointer; padding: 0; }
  .remove-option:hover { opacity: 0.8; }
</style>
