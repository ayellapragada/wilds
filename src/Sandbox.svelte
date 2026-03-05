<script lang="ts">
  import { resolveAction } from '../engine/action-resolver';
  import { createInitialState } from '../engine/index';
  import { getAllTemplateIds, getTemplate, createCreature, resetCreatureIdCounter } from '../engine/creatures/catalog';
  import { shuffle } from '../engine/models/deck';
  import type { GameState, GameEvent, Creature } from '../engine/types';

  // Catalog
  const templateIds = getAllTemplateIds();
  const grouped = $derived.by(() => {
    const groups: Record<string, string[]> = { common: [], uncommon: [], rare: [], legendary: [] };
    for (const id of templateIds) {
      const t = getTemplate(id);
      groups[t.rarity].push(id);
    }
    return groups;
  });

  // Deck builder
  let deckEntries: { templateId: string; count: number }[] = $state([]);
  let manualOrder = $state(false);

  function addToDeck(templateId: string) {
    const existing = deckEntries.find(e => e.templateId === templateId);
    if (existing) {
      existing.count++;
      deckEntries = [...deckEntries]; // trigger reactivity
    } else {
      deckEntries = [...deckEntries, { templateId, count: 1 }];
    }
  }

  function removeFromDeck(templateId: string) {
    const existing = deckEntries.find(e => e.templateId === templateId);
    if (!existing) return;
    if (existing.count > 1) {
      existing.count--;
      deckEntries = [...deckEntries];
    } else {
      deckEntries = deckEntries.filter(e => e.templateId !== templateId);
    }
  }

  function moveDeckEntry(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= deckEntries.length) return;
    const copy = [...deckEntries];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    deckEntries = copy;
  }

  let totalDeckSize = $derived(deckEntries.reduce((sum, e) => sum + e.count, 0));

  function loadStarterDeck() {
    deckEntries = [
      { templateId: 'scout', count: 3 },
      { templateId: 'wanderer', count: 3 },
      { templateId: 'spark', count: 1 },
      { templateId: 'ripple', count: 1 },
      { templateId: 'gust', count: 1 },
    ];
  }

  // Game state
  let gameState: GameState | null = $state(null);
  let events: GameEvent[] = $state([]);
  let running = $derived(gameState !== null && gameState.phase === 'route');
  const TRAINER_ID = 'sandbox';

  let myTrainer = $derived(gameState?.trainers[TRAINER_ID] ?? null);

  function startRoute() {
    if (deckEntries.length === 0) return;
    resetCreatureIdCounter();

    // Build creatures from entries
    let creatures: Creature[] = [];
    for (const entry of deckEntries) {
      for (let i = 0; i < entry.count; i++) {
        creatures.push(createCreature(entry.templateId));
      }
    }

    if (!manualOrder) {
      creatures = shuffle(creatures);
    }

    // Create a game state, join, start, then swap in our custom deck
    let state = createInitialState('SANDBOX');
    [state] = resolveAction(state, { type: 'join_game', trainerName: 'Sandbox', sessionToken: TRAINER_ID });
    [state] = resolveAction(state, { type: 'start_game', trainerId: TRAINER_ID });

    // Replace deck with our custom one
    state = {
      ...state,
      trainers: {
        ...state.trainers,
        [TRAINER_ID]: {
          ...state.trainers[TRAINER_ID],
          deck: { drawPile: creatures, drawn: [], discard: [] },
        },
      },
    };

    gameState = state;
    events = [];
  }

  function hit() {
    if (!gameState) return;
    const [newState, newEvents] = resolveAction(gameState, { type: 'hit', trainerId: TRAINER_ID });
    gameState = newState;
    events = [...newEvents, ...events];
  }

  function stop() {
    if (!gameState) return;
    const [newState, newEvents] = resolveAction(gameState, { type: 'stop', trainerId: TRAINER_ID });
    gameState = newState;
    events = [...newEvents, ...events];
  }

  function choosePenalty(choice: 'keep_score' | 'keep_currency') {
    if (!gameState) return;
    const [newState, newEvents] = resolveAction(gameState, { type: 'choose_bust_penalty', trainerId: TRAINER_ID, choice });
    gameState = newState;
    events = [...newEvents, ...events];
  }

  function reset() {
    gameState = null;
    events = [];
  }

  function formatAbility(ability: import('../engine/abilities/types').AbilityData | null): string {
    if (!ability) return '';
    let s = `Trigger: ${ability.trigger}`;
    if (ability.condition) {
      const c = ability.condition;
      switch (c.type) {
        case 'element_count': s += `\nIf: ${c.min}+ ${c.element} creatures`; break;
        case 'min_cards_played': s += `\nIf: ${c.min}+ creatures drawn`; break;
        case 'position': s += `\nIf: drawn ${c.position}`; break;
        case 'would_bust': s += `\nIf: would bust`; break;
        case 'neighbor_element': s += `\nIf: neighbor is ${c.element}`; break;
      }
    }
    const e = ability.effect;
    switch (e.type) {
      case 'bonus_distance': s += `\nEffect: +${e.amount} distance`; break;
      case 'bonus_distance_per': s += `\nEffect: +${e.amount} distance per ${e.element}`; break;
      case 'reduce_cost': s += `\nEffect: ${e.amount === 'all' ? 'remove all' : '-' + e.amount} cost (${e.target})`; break;
      case 'modify_threshold': s += `\nEffect: +${e.amount} bust threshold`; break;
      case 'bonus_currency': s += `\nEffect: +${e.amount} currency`; break;
      case 'peek_deck': s += `\nEffect: peek ${e.count} cards`; break;
      case 'negate_bust': s += `\nEffect: negate bust`; break;
    }
    return s;
  }

  function cardTooltip(t: { name: string; element: string; distance: number; cost: number; rarity: string; description: string; ability: import('../engine/abilities/types').AbilityData | null }): string {
    let tip = `${t.name} [${t.element}] — ${t.rarity}\n+${t.distance} distance / +${t.cost} cost\n${t.description}`;
    const abilityText = formatAbility(t.ability);
    if (abilityText) tip += `\n\n${abilityText}`;
    return tip;
  }

  function elementColor(element: string): string {
    const colors: Record<string, string> = {
      fire: '#ffe0e0', water: '#e0e8ff', earth: '#e0ffe0',
      air: '#f0f0f0', shadow: '#e0d8f0', light: '#fffde0',
    };
    return colors[element] ?? '#fff';
  }

  function rarityBorder(rarity: string): string {
    const colors: Record<string, string> = {
      common: '#aaa', uncommon: '#4a9', rare: '#c4a', legendary: '#da2',
    };
    return colors[rarity] ?? '#aaa';
  }

  function formatEffect(event: GameEvent): string {
    if (event.type === 'ability_triggered') {
      const e = event.effect;
      switch (e.type) {
        case 'bonus_distance': return `+${e.amount} distance`;
        case 'reduce_cost': return `${e.amount === 'all' ? 'all' : '-' + e.amount} cost (${e.target})`;
        case 'modify_threshold': return `+${e.amount} threshold`;
        case 'negate_bust': return 'bust negated!';
        case 'bonus_currency': return `+${e.amount} currency`;
        case 'peek_deck': return `peek ${e.count} cards`;
        default: return JSON.stringify(e);
      }
    }
    if (event.type === 'creature_drawn') return `Drew ${event.creature.name}`;
    if (event.type === 'trainer_busted') return `BUSTED! Cost ${event.totalCost}`;
    if (event.type === 'trainer_stopped') return `Stopped at distance ${event.totalDistance}`;
    if (event.type === 'bust_penalty_chosen') return `Chose: ${event.choice}`;
    return event.type;
  }
</script>

<main>
  <h1>Sandbox</h1>
  <a href="#/" style="font-size: 0.85rem; color: #666;">← Back to game</a>

  <div class="layout">
    <!-- Left: Deck Builder -->
    <section class="panel">
      <div class="deck-header">
        <h2>Deck Builder</h2>
        <button class="small" onclick={loadStarterDeck}>Load Starter</button>
      </div>

      {#each ['common', 'uncommon', 'rare', 'legendary'] as rarity}
        {#if grouped[rarity].length > 0}
          <h3 class="rarity-header" style="border-left: 3px solid {rarityBorder(rarity)}">{rarity}</h3>
          <div class="catalog-grid">
            {#each grouped[rarity] as id}
              {@const t = getTemplate(id)}
              <button
                class="catalog-card"
                style="background: {elementColor(t.element)}; border-color: {rarityBorder(t.rarity)}"
                onclick={() => addToDeck(id)}
                data-tooltip={cardTooltip(t)}
              >
                <span class="card-name">{t.name}</span>
                <span class="card-stats">+{t.distance}d / +{t.cost}c</span>
                {#if t.ability}
                  <span class="card-ability">★</span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      {/each}

      <div class="deck-header">
        <h3>Your Deck ({totalDeckSize} cards)</h3>
        {#if deckEntries.length > 0}
          <button class="small" onclick={() => { deckEntries = []; reset(); }}>Clear</button>
        {/if}
      </div>
      {#if deckEntries.length === 0}
        <p class="hint">Click creatures above to add them.</p>
      {:else}
        <div class="deck-list">
          {#each deckEntries as entry, i}
            {@const t = getTemplate(entry.templateId)}
            <div class="deck-row" style="background: {elementColor(t.element)}" data-tooltip={cardTooltip(t)}>
              {#if manualOrder}
                <button class="tiny" onclick={() => moveDeckEntry(i, -1)} disabled={i === 0}>↑</button>
                <button class="tiny" onclick={() => moveDeckEntry(i, 1)} disabled={i === deckEntries.length - 1}>↓</button>
              {/if}
              <span class="deck-name">{t.name} ×{entry.count}</span>
              <span class="deck-stats">+{t.distance}d/+{t.cost}c</span>
              <button class="tiny remove" onclick={() => removeFromDeck(entry.templateId)}>−</button>
              <button class="tiny add" onclick={() => addToDeck(entry.templateId)}>+</button>
            </div>
          {/each}
        </div>
      {/if}

      <div class="deck-controls">
        <label>
          <input type="checkbox" bind:checked={manualOrder} />
          Manual draw order
        </label>
        <button onclick={startRoute} disabled={totalDeckSize === 0 || running}>
          Start Route
        </button>
      </div>
    </section>

    <!-- Right: Route Stepper -->
    <section class="panel">
      <h2>Route</h2>

      {#if !gameState}
        <p class="hint">Build a deck and click Start Route.</p>
      {:else if myTrainer}
        <div class="stats-bar">
          <div class="stat">
            <span class="stat-label">Distance</span>
            <span class="stat-value">{myTrainer.routeProgress.totalDistance}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Cost</span>
            <span class="stat-value">{myTrainer.routeProgress.totalCost} / {myTrainer.bustThreshold}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Drawn</span>
            <span class="stat-value">{myTrainer.routeProgress.creaturesDrawn}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Deck left</span>
            <span class="stat-value">{myTrainer.deck.drawPile.length}</span>
          </div>
        </div>

        <div class="actions">
          {#if myTrainer.status === 'exploring'}
            <button class="action-btn hit" onclick={hit} disabled={myTrainer.deck.drawPile.length === 0}>
              HIT
            </button>
            <button class="action-btn stop" onclick={stop} disabled={myTrainer.routeProgress.creaturesDrawn === 0}>
              STOP
            </button>
          {:else if myTrainer.status === 'busted'}
            <p class="bust-msg">WENT WILD! Cost {myTrainer.routeProgress.totalCost} exceeded {myTrainer.bustThreshold}.</p>
            <button class="action-btn" onclick={() => choosePenalty('keep_score')}>
              Keep Score (+{myTrainer.routeProgress.totalDistance})
            </button>
            <button class="action-btn" onclick={() => choosePenalty('keep_currency')}>
              Keep Currency (+{Math.floor(myTrainer.routeProgress.totalDistance / 3)})
            </button>
          {:else}
            <div class="result">
              <p>Score: <strong>{myTrainer.score}</strong> | Currency: <strong>{myTrainer.currency}</strong></p>
            </div>
          {/if}
          <button class="action-btn reset" onclick={reset}>Reset</button>
        </div>

        {#if myTrainer.deck.drawn.length > 0}
          <h3>Drawn Creatures</h3>
          <div class="drawn-list">
            {#each myTrainer.deck.drawn as creature, i}
              <div class="drawn-card" style="background: {elementColor(creature.type)}; border-color: {rarityBorder(creature.rarity)}" data-tooltip={cardTooltip({ name: creature.name, element: creature.type, distance: creature.distance, cost: creature.cost, rarity: creature.rarity, description: creature.description, ability: creature.ability })}>
                <div class="drawn-card-header">
                  <span class="drawn-num">#{i + 1}</span>
                  <strong>{creature.name}</strong>
                </div>
                <span class="drawn-card-stats">+{creature.distance}d / +{creature.cost}c</span>
                {#if creature.ability}
                  <span class="drawn-card-desc">{creature.description}</span>
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        {#if manualOrder && myTrainer.deck.drawPile.length > 0}
          <h3>Draw Pile (next up)</h3>
          <div class="draw-pile">
            {#each myTrainer.deck.drawPile as creature, i}
              <span class="pile-card" style="background: {elementColor(creature.type)}" data-tooltip={cardTooltip({ name: creature.name, element: creature.type, distance: creature.distance, cost: creature.cost, rarity: creature.rarity, description: creature.description, ability: creature.ability })}>
                {i + 1}. {creature.name}
              </span>
            {/each}
          </div>
        {/if}

        <h3>Event Log</h3>
        <div class="event-log">
          {#each events as event}
            <div class="event" class:ability={event.type === 'ability_triggered'} class:bust={event.type === 'trainer_busted'}>
              {formatEffect(event)}
            </div>
          {/each}
          {#if events.length === 0}
            <p class="hint">Events will appear here as you draw.</p>
          {/if}
        </div>
      {/if}
    </section>
  </div>
</main>

<style>
  main {
    font-family: system-ui, sans-serif;
    max-width: 1100px;
    margin: 0 auto;
    padding: 1rem;
  }

  .layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-top: 1rem;
  }

  .panel {
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 8px;
    overflow-y: auto;
    max-height: 85vh;
  }

  .deck-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .deck-header h2 { margin: 0; }

  .rarity-header {
    padding-left: 0.5rem;
    margin: 0.75rem 0 0.25rem;
    font-size: 0.8rem;
    text-transform: uppercase;
    color: #666;
  }

  .catalog-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 0.35rem;
  }

  .catalog-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 0.35rem 0.5rem;
    border: 1.5px solid;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8rem;
    position: relative;
    text-align: left;
  }

  .catalog-card:hover { filter: brightness(0.95); }

  .card-name { font-weight: 600; font-size: 0.8rem; }
  .card-stats { font-size: 0.7rem; color: #555; }
  .card-ability {
    position: absolute;
    top: 2px;
    right: 4px;
    font-size: 0.65rem;
    color: #c80;
  }

  .deck-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .deck-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
  }

  .deck-name { flex: 1; font-weight: 500; }
  .deck-stats { color: #555; font-size: 0.75rem; }

  .deck-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.75rem;
    gap: 0.5rem;
  }

  .deck-controls label {
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  button {
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    border: 1px solid #666;
    background: #fff;
    cursor: pointer;
    font-size: 0.85rem;
  }

  button:hover { background: #eee; }
  button:disabled { opacity: 0.4; cursor: default; }

  .small { font-size: 0.75rem; padding: 0.2rem 0.5rem; }
  .tiny { font-size: 0.75rem; padding: 0.1rem 0.35rem; min-width: 1.5rem; }
  .tiny.remove { color: #c33; border-color: #c33; }
  .tiny.add { color: #3a3; border-color: #3a3; }

  /* Route stepper */
  .stats-bar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .stat {
    text-align: center;
    padding: 0.5rem;
    background: #f8f8f8;
    border-radius: 6px;
  }

  .stat-label { font-size: 0.7rem; color: #888; display: block; }
  .stat-value { font-size: 1.1rem; font-weight: 700; }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
    align-items: center;
  }

  .action-btn {
    padding: 0.5rem 1.2rem;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .action-btn.hit { background: #e8f5e9; border-color: #4caf50; }
  .action-btn.hit:hover { background: #c8e6c9; }
  .action-btn.stop { background: #fff3e0; border-color: #ff9800; }
  .action-btn.stop:hover { background: #ffe0b2; }
  .action-btn.reset { background: #fce4ec; border-color: #e91e63; font-size: 0.75rem; padding: 0.3rem 0.7rem; }

  .bust-msg { color: #c33; font-weight: 700; margin: 0; }

  .result p { margin: 0; }

  .drawn-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-bottom: 1rem;
  }

  .drawn-card {
    padding: 0.4rem 0.6rem;
    border: 1.5px solid;
    border-radius: 6px;
    font-size: 0.85rem;
  }

  .drawn-card-header {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  .drawn-num { color: #999; font-size: 0.75rem; }
  .drawn-card-stats { font-size: 0.75rem; color: #555; }
  .drawn-card-desc { font-size: 0.7rem; color: #888; font-style: italic; display: block; }

  .draw-pile {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-bottom: 1rem;
  }

  .pile-card {
    padding: 0.15rem 0.4rem;
    border-radius: 3px;
    font-size: 0.75rem;
    border: 1px solid #ccc;
  }

  .event-log {
    max-height: 200px;
    overflow-y: auto;
    font-size: 0.8rem;
    font-family: monospace;
  }

  .event { padding: 0.15rem 0; color: #666; }
  .event.ability { color: #c80; font-weight: 500; }
  .event.bust { color: #c33; font-weight: 700; }

  .hint { color: #999; font-style: italic; font-size: 0.85rem; }

  /* CSS tooltips */
  [data-tooltip] {
    position: relative;
  }

  [data-tooltip]::after {
    content: attr(data-tooltip);
    position: absolute;
    left: 50%;
    bottom: calc(100% + 6px);
    transform: translateX(-50%);
    background: #222;
    color: #fff;
    padding: 0.5rem 0.65rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 400;
    font-style: normal;
    white-space: pre-line;
    width: max-content;
    max-width: 260px;
    z-index: 100;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.1s;
    line-height: 1.4;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  }

  [data-tooltip]:hover::after {
    opacity: 1;
  }
</style>
