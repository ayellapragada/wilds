<script lang="ts">
  import type { PhoneViewState, Action, Pokemon } from '../../../engine/types';
  import { spriteUrl } from '../../lib/assets';
  import { copy } from '../../../copy';

  let { gameState, send }: {
    gameState: PhoneViewState;
    send: (action: Action) => void;
  } = $props();

  let me = $derived(gameState.me);
  let trainerCount = $derived(1 + Object.keys(gameState.otherTrainers).length);

  let expandedId: string | null = $state(null);

  let selectionCost = $derived.by(() => {
    if (!gameState.hub) return 0;
    const selections = gameState.hub.selections[me.id] ?? [];
    const prices = gameState.hub.shopPrices;
    return selections.reduce((sum, id) => sum + (prices[id] ?? 0), 0);
  });

  function toggleExpand(id: string) {
    expandedId = expandedId === id ? null : id;
  }

  function toggleSelect(pkmn: Pokemon) {
    send({ type: 'select_pokemon', trainerId: me.id, pokemonId: pkmn.id });
  }
</script>

<section>
  <h2>{copy.hub}</h2>
  <p>{copy.score}: {me.score} | {copy.currency}: {me.currency}{#if selectionCost > 0}<span class="ghost-cost"> − {selectionCost}</span>{/if}</p>

  {#if gameState.hub}
    {@const mySelections = gameState.hub.selections[me.id] ?? []}
    {@const isConfirmed = gameState.hub.confirmedTrainers.includes(me.id)}
    {@const myFreeOffers = gameState.hub.freePickOffers[me.id] ?? []}

    <p class="selection-status">{mySelections.length}/2 selected</p>

    <div class="shop-items">
      {#each myFreeOffers as pkmn}
        {@const selected = mySelections.includes(pkmn.id)}
        {@const expanded = expandedId === pkmn.id}
        {@const disabled = isConfirmed || (!selected && mySelections.length >= 2)}
        <div class="pokemon-card" class:selected class:expanded>
          <button class="card-row" onclick={() => toggleExpand(pkmn.id)}>
            <img class="sprite" src={spriteUrl(pkmn.templateId)} alt={pkmn.name} />
            <div class="card-info">
              <strong>{pkmn.name}</strong>
              <span class="stats">+{pkmn.distance}{copy.distanceAbbr} / +{pkmn.cost}{copy.costAbbr}</span>
            </div>
            <span class="price free">{copy.free}</span>
            <span class="chevron">{expanded ? '▲' : '▼'}</span>
          </button>
          {#if expanded}
            <div class="details">
              <div class="detail-row">
                <span class="types">{pkmn.types.join(' / ')}</span>
                <span class="rarity {pkmn.rarity}">{pkmn.rarity}</span>
              </div>
              {#if pkmn.description}
                <p class="description">{pkmn.description}</p>
              {/if}
              {#each pkmn.moves as move}
                <div class="move">
                  <strong>{move.name}</strong>
                  <span>{move.reminderText}</span>
                </div>
              {/each}
              <button
                class="select-btn"
                class:selected
                {disabled}
                onclick={() => toggleSelect(pkmn)}
              >
                {selected ? '✓ Selected' : 'Select'}
              </button>
            </div>
          {/if}
        </div>
      {/each}
      {#each gameState.hub.shopPokemon as pkmn}
        {@const price = gameState.hub.shopPrices[pkmn.id] ?? 0}
        {@const selected = mySelections.includes(pkmn.id)}
        {@const expanded = expandedId === pkmn.id}
        {@const disabled = isConfirmed || (!selected && (mySelections.length >= 2 || me.currency < price))}
        <div class="pokemon-card" class:selected class:expanded>
          <button class="card-row" onclick={() => toggleExpand(pkmn.id)}>
            <img class="sprite" src={spriteUrl(pkmn.templateId)} alt={pkmn.name} />
            <div class="card-info">
              <strong>{pkmn.name}</strong>
              <span class="stats">+{pkmn.distance}{copy.distanceAbbr} / +{pkmn.cost}{copy.costAbbr}</span>
            </div>
            <span class="price">${price}</span>
            <span class="chevron">{expanded ? '▲' : '▼'}</span>
          </button>
          {#if expanded}
            <div class="details">
              <div class="detail-row">
                <span class="types">{pkmn.types.join(' / ')}</span>
                <span class="rarity {pkmn.rarity}">{pkmn.rarity}</span>
              </div>
              {#if pkmn.description}
                <p class="description">{pkmn.description}</p>
              {/if}
              {#each pkmn.moves as move}
                <div class="move">
                  <strong>{move.name}</strong>
                  <span>{move.reminderText}</span>
                </div>
              {/each}
              <button
                class="select-btn"
                class:selected
                {disabled}
                onclick={() => toggleSelect(pkmn)}
              >
                {selected ? '✓ Selected' : 'Select'}
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    {#if isConfirmed}
      <p>{copy.waitingForOthers} ({gameState.hub.confirmedTrainers.length}/{trainerCount})</p>
    {:else}
      <button class="confirm-btn" onclick={() => send({ type: 'confirm_selections', trainerId: me.id })}>
        {copy.confirmButton} ({mySelections.length}/2)
      </button>
    {/if}
  {/if}
</section>

<style>
  section { padding: 0.5rem; }
  .ghost-cost { color: #cc4444; opacity: 0.6; font-style: italic; }
  .selection-status { font-size: 0.9rem; font-weight: bold; margin: 0.25rem 0; }
  .shop-items { display: flex; flex-direction: column; gap: 0.4rem; margin: 0.5rem 0; }
  .sprite { width: 2rem; height: 1.7rem; image-rendering: pixelated; flex-shrink: 0; }

  .pokemon-card { border: 2px solid #ccc; border-radius: 0.4rem; background: #fff; overflow: hidden; }
  .pokemon-card.selected { border-color: gold; background: rgba(255, 215, 0, 0.1); }

  .card-row { display: flex; flex-direction: row; align-items: center; gap: 0.4rem; padding: 0.4rem 0.6rem; cursor: pointer; text-align: left; width: 100%; font-size: 0.8rem; background: none; border: none; font: inherit; color: inherit; }
  .card-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .card-info strong { font-size: 0.8rem; }
  .stats { font-size: 0.7rem; color: #444; }
  .price { font-weight: bold; color: #c8a020; font-size: 0.8rem; flex-shrink: 0; }
  .price.free { color: green; }
  .chevron { font-size: 0.6rem; color: #999; flex-shrink: 0; }

  .details { padding: 0.3rem 0.6rem 0.5rem; border-top: 1px solid #eee; font-size: 0.75rem; }
  .detail-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem; }
  .types { text-transform: capitalize; color: #555; }
  .rarity { text-transform: capitalize; font-weight: bold; font-size: 0.65rem; padding: 0.1rem 0.3rem; border-radius: 0.2rem; }
  .rarity.common { color: #666; background: #eee; }
  .rarity.uncommon { color: #2a7a2a; background: #e0ffe0; }
  .rarity.rare { color: #2a5aaa; background: #ddeeff; }
  .rarity.legendary { color: #aa6a00; background: #fff3d0; }
  .description { margin: 0.2rem 0; color: #555; font-style: italic; }
  .move { margin: 0.15rem 0; }
  .move strong { font-size: 0.7rem; }
  .move span { font-size: 0.65rem; color: #666; margin-left: 0.2rem; }

  .select-btn { margin-top: 0.3rem; padding: 0.3rem 0.8rem; font-size: 0.75rem; background: #f0f0f0; border: 1px solid #ccc; border-radius: 0.3rem; cursor: pointer; width: 100%; }
  .select-btn.selected { background: rgba(255, 215, 0, 0.2); border-color: gold; font-weight: bold; }
  .select-btn:disabled { opacity: 0.4; cursor: default; }

  .confirm-btn { margin-top: 0.5rem; padding: 0.5rem 1.5rem; font-size: 0.9rem; background: #4a90d9; color: white; border: none; border-radius: 0.5rem; cursor: pointer; }
  .confirm-btn:hover { background: #3a7cc9; }
</style>
