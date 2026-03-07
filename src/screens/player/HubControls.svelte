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
  let showConfirmWarning = $state(false);

  let selectionCost = $derived.by(() => {
    if (!gameState.hub) return 0;
    const selections = gameState.hub.selections[me.id] ?? [];
    const prices = gameState.hub.shopPrices;
    return selections.reduce((sum, id) => sum + (prices[id] ?? 0), 0);
  });

  function toggleExpand(id: string) {
    expandedId = expandedId === id ? null : id;
  }

  let couldStillPick = $derived.by(() => {
    if (!gameState.hub) return false;
    const mySelections = gameState.hub.selections[me.id] ?? [];
    if (mySelections.length >= 2) return false;

    const myFreeOffers = gameState.hub.freePickOffers[me.id] ?? [];
    const hasUnselectedFree = myFreeOffers.some(p => !mySelections.includes(p.id));
    if (hasUnselectedFree) return true;

    const alreadySpending = mySelections.reduce((sum, id) => sum + (gameState.hub!.shopPrices[id] ?? 0), 0);
    const remaining = me.currency - alreadySpending;
    const canAffordShop = gameState.hub.shopPokemon.some(p =>
      !mySelections.includes(p.id) && (gameState.hub!.shopPrices[p.id] ?? 0) <= remaining
    );
    return canAffordShop;
  });

  function handleConfirm() {
    const mySelections = gameState.hub?.selections[me.id] ?? [];
    if (mySelections.length < 2 && couldStillPick) {
      showConfirmWarning = true;
      return;
    }
    send({ type: 'confirm_selections', trainerId: me.id });
  }

  function toggleSelect(pkmn: Pokemon) {
    showConfirmWarning = false;
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
      {#if showConfirmWarning}
        <div class="confirm-warning">
          <span class="warning-icon">⚠️</span>
          <p class="warning-title">You still have picks left!</p>
          <p class="warning-subtitle">Only {mySelections.length} of 2 selected — skip the rest?</p>
          <div class="confirm-warning-actions">
            <button class="warning-btn back" onclick={() => showConfirmWarning = false}>Keep shopping</button>
            <button class="warning-btn skip" onclick={() => { showConfirmWarning = false; send({ type: 'confirm_selections', trainerId: me.id }); }}>Skip</button>
          </div>
        </div>
      {:else}
        <button class="btn-primary confirm-btn" onclick={handleConfirm}>
          {copy.confirmButton} ({mySelections.length}/2)
        </button>
      {/if}
    {/if}
  {/if}
</section>

<style>
  section { padding: var(--space-4); }
  .ghost-cost { color: var(--color-danger-text); opacity: 0.6; font-style: italic; }
  .selection-status { font-size: var(--text-md); font-weight: bold; margin: var(--space-2) 0; }
  .shop-items { display: flex; flex-direction: column; gap: 0.4rem; margin: var(--space-4) 0; }
  .sprite { width: 2rem; height: 1.7rem; image-rendering: pixelated; flex-shrink: 0; }

  .pokemon-card { border: 2px solid var(--color-border); border-radius: 0.4rem; background: var(--color-bg); overflow: hidden; }
  .pokemon-card.selected { border-color: gold; background: rgba(255, 215, 0, 0.1); }

  .card-row { display: flex; flex-direction: row; align-items: center; gap: 0.4rem; padding: 0.4rem 0.6rem; cursor: pointer; text-align: left; width: 100%; font-size: var(--text-body); background: none; border: none; font: inherit; color: inherit; }
  .card-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .card-info strong { font-size: var(--text-body); }
  .stats { font-size: var(--text-detail); color: var(--color-text-secondary); }
  .price { font-weight: bold; color: var(--color-gold); font-size: var(--text-body); flex-shrink: 0; }
  .price.free { color: green; }
  .chevron { font-size: 0.6rem; color: var(--color-text-faint); flex-shrink: 0; }

  .details { padding: 0.3rem 0.6rem var(--space-4); border-top: 1px solid var(--color-border-lighter); font-size: var(--text-sm); }
  .detail-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem; }
  .types { text-transform: capitalize; color: var(--color-text-secondary); }
  .rarity { text-transform: capitalize; font-weight: bold; font-size: var(--text-xs); padding: 0.1rem 0.3rem; border-radius: 0.2rem; }
  .rarity.common { color: var(--color-text-muted); background: var(--color-bg-hover); }
  .rarity.uncommon { color: var(--color-success-confirmed); background: var(--color-success-confirmed-bg); }
  .rarity.rare { color: var(--color-primary-dark); background: #ddeeff; }
  .rarity.legendary { color: #aa6a00; background: var(--color-gold-bg); }
  .description { margin: 0.2rem 0; color: var(--color-text-secondary); font-style: italic; }
  .move { margin: var(--space-1) 0; }
  .move strong { font-size: var(--text-detail); }
  .move span { font-size: var(--text-xs); color: var(--color-text-muted); margin-left: 0.2rem; }

  .select-btn { margin-top: 0.3rem; padding: 0.3rem 0.8rem; font-size: var(--text-sm); background: var(--color-bg-muted); border: 1px solid var(--color-border); border-radius: 0.3rem; cursor: pointer; width: 100%; }
  .select-btn.selected { background: rgba(255, 215, 0, 0.2); border-color: gold; font-weight: bold; }
  .select-btn:disabled { opacity: 0.4; cursor: default; }

  .confirm-btn { margin-top: var(--space-4); padding: var(--space-4) var(--space-7); font-size: var(--text-md); border-radius: var(--space-4); }
  .confirm-btn:hover { background: var(--color-primary-hover); }

  .confirm-warning { margin-top: var(--space-4); padding: var(--space-5) var(--space-4); border-radius: 0.6rem; background: var(--color-bg-muted); text-align: center; display: flex; flex-direction: column; align-items: center; gap: var(--space-2); }
  .warning-icon { font-size: 1.6rem; line-height: 1; }
  .warning-title { margin: 0; font-weight: bold; font-size: var(--text-md); }
  .warning-subtitle { margin: 0; font-size: var(--text-sm); color: var(--color-text-secondary); }
  .confirm-warning-actions { display: flex; gap: var(--space-3); margin-top: var(--space-3); width: 100%; }
  .warning-btn { flex: 1; padding: var(--space-4); border-radius: var(--space-3); font-size: var(--text-body); font-weight: 600; cursor: pointer; border: none; }
  .warning-btn.back { background: var(--color-primary); color: white; }
  .warning-btn.back:hover { background: var(--color-primary-hover); }
  .warning-btn.skip { background: transparent; border: 1px solid var(--color-border); color: var(--color-text-secondary); }
  .warning-btn.skip:hover { background: var(--color-bg-hover); }
</style>
