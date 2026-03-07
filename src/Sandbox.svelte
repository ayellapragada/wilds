<script lang="ts">
  import PreviewShell from './sandbox/PreviewShell.svelte';
  import { resolveAction } from '../engine/action-resolver';
  import { createInitialState } from '../engine/index';
  import { getAllTemplateIds, getTemplate, createPokemon, resetPokemonIdCounter } from '../engine/pokemon/catalog';
  import { spriteUrl, typeColor } from './lib/assets';
  import { shuffle } from '../engine/models/deck';
  import type { GameState, GameEvent, Pokemon } from '../engine/types';
  import type { Move } from '../engine/abilities/types';

  let activeTab = $state<'route' | 'preview'>('preview');

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
      { templateId: 'rattata', count: 3 },
      { templateId: 'pidgey', count: 2 },
      { templateId: 'caterpie', count: 1 },
      { templateId: 'charmander', count: 1 },
      { templateId: 'squirtle', count: 1 },
      { templateId: 'bulbasaur', count: 1 },
    ];
  }

  // Game state
  let gameState = $state<GameState | null>(null);
  let events: GameEvent[] = $state([]);
  let running = $derived(gameState !== null && gameState.phase === 'route');
  const TRAINER_ID = 'sandbox';

  let myTrainer = $derived(gameState?.trainers[TRAINER_ID] ?? null);

  function startRoute() {
    if (deckEntries.length === 0) return;
    resetPokemonIdCounter();

    // Build pokemon from entries
    let pokemon: Pokemon[] = [];
    for (const entry of deckEntries) {
      for (let i = 0; i < entry.count; i++) {
        pokemon.push(createPokemon(entry.templateId));
      }
    }

    if (!manualOrder) {
      pokemon = shuffle(pokemon);
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
          deck: { drawPile: pokemon, drawn: [], discard: [] },
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

  function formatMove(move: Move): string {
    let s = `${move.name}: ${move.reminderText}`;
    return s;
  }

  function cardTooltip(t: { name: string; types: readonly string[]; distance: number; cost: number; rarity: string; description: string; moves: readonly Move[] }): string {
    let tip = `${t.name} [${t.types.join('/')}] — ${t.rarity}\n+${t.distance} distance / +${t.cost} cost\n${t.description}`;
    if (t.moves.length > 0) {
      tip += '\n\n' + t.moves.map(m => formatMove(m)).join('\n');
    }
    return tip;
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
    if (event.type === 'pokemon_drawn') return `Drew ${event.pokemon.name}`;
    if (event.type === 'trainer_busted') return `BUSTED! Cost ${event.totalCost}`;
    if (event.type === 'trainer_stopped') return `Stopped at distance ${event.totalDistance}`;
    if (event.type === 'bust_penalty_chosen') return `Chose: ${event.choice}`;
    return event.type;
  }
</script>

<main>
  <h1>Sandbox</h1>
  <a href="#/" class="nav-link">← Back to game</a>

  <nav class="sandbox-tabs">
    <button
      class="sandbox-tab"
      class:active={activeTab === 'preview'}
      onclick={() => activeTab = 'preview'}
    >
      Screen Preview
    </button>
    <button
      class="sandbox-tab"
      class:active={activeTab === 'route'}
      onclick={() => activeTab = 'route'}
    >
      Route Sandbox
    </button>
  </nav>

  {#if activeTab === 'preview'}
    <PreviewShell />
  {:else}
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
                style="background: {typeColor(t.types)}; border-color: {rarityBorder(t.rarity)}"
                onclick={() => addToDeck(id)}
                data-tooltip={cardTooltip(t)}
              >
                <img class="sprite" src={spriteUrl(id)} alt={t.name} />
                <span class="card-name">{t.name}</span>
                <span class="card-stats">+{t.distance}d / +{t.cost}c</span>
                {#if t.moves.length > 0}
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
        <p class="hint">Click Pokemon above to add them.</p>
      {:else}
        <div class="deck-list">
          {#each deckEntries as entry, i}
            {@const t = getTemplate(entry.templateId)}
            <div class="deck-row" style="background: {typeColor(t.types)}" data-tooltip={cardTooltip(t)}>
              {#if manualOrder}
                <button class="tiny" onclick={() => moveDeckEntry(i, -1)} disabled={i === 0}>↑</button>
                <button class="tiny" onclick={() => moveDeckEntry(i, 1)} disabled={i === deckEntries.length - 1}>↓</button>
              {/if}
              <img class="sprite-sm" src={spriteUrl(entry.templateId)} alt={t.name} />
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
            <span class="stat-value">{myTrainer.routeProgress.pokemonDrawn}</span>
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
            <button class="action-btn stop" onclick={stop} disabled={myTrainer.routeProgress.pokemonDrawn === 0}>
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
          <h3>Drawn Pokemon</h3>
          <div class="drawn-list">
            {#each myTrainer.deck.drawn as pkmn, i}
              <div class="drawn-card" style="background: {typeColor(pkmn.types)}; border-color: {rarityBorder(pkmn.rarity)}" data-tooltip={cardTooltip({ name: pkmn.name, types: pkmn.types, distance: pkmn.distance, cost: pkmn.cost, rarity: pkmn.rarity, description: pkmn.description, moves: pkmn.moves })}>
                <div class="drawn-card-header">
                  <span class="drawn-num">#{i + 1}</span>
                  <img class="sprite" src={spriteUrl(pkmn.templateId)} alt={pkmn.name} />
                  <strong>{pkmn.name}</strong>
                  <span class="drawn-card-types">{pkmn.types.join('/')}</span>
                </div>
                <span class="drawn-card-stats">+{pkmn.distance}d / +{pkmn.cost}c</span>
                {#if pkmn.moves.length > 0}
                  <span class="drawn-card-desc">{pkmn.moves.map(m => m.name).join(', ')}</span>
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        {#if manualOrder && myTrainer.deck.drawPile.length > 0}
          <h3>Draw Pile (next up)</h3>
          <div class="draw-pile">
            {#each myTrainer.deck.drawPile as pkmn, i}
              <span class="pile-card" style="background: {typeColor(pkmn.types)}" data-tooltip={cardTooltip({ name: pkmn.name, types: pkmn.types, distance: pkmn.distance, cost: pkmn.cost, rarity: pkmn.rarity, description: pkmn.description, moves: pkmn.moves })}>
                {i + 1}. {pkmn.name}
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
  {/if}
</main>

<style>
  main {
    max-width: 1100px;
    margin: 0 auto;
    padding: var(--space-6);
    overflow-x: hidden;
  }

  .sandbox-tabs {
    display: flex;
    gap: 0;
    margin-top: var(--space-5);
    margin-bottom: var(--space-6);
    border-bottom: 2px solid var(--color-border-light);
  }

  .sandbox-tab {
    padding: var(--space-4) 1.2rem;
    border: none;
    background: none;
    cursor: pointer;
    font-size: var(--text-md);
    font-weight: 500;
    color: var(--color-text-muted);
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    transition: color var(--duration-normal), border-color var(--duration-normal);
  }

  .sandbox-tab:hover {
    color: var(--color-text);
  }

  .sandbox-tab.active {
    color: var(--color-accent);
    border-bottom-color: var(--color-accent);
  }

  .layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-6);
    margin-top: var(--space-6);
    overflow: hidden;
  }

  .panel {
    padding: var(--space-6);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow-x: hidden;
    overflow-y: auto;
    max-height: 85vh;
    min-width: 0;
  }

  .deck-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .deck-header h2 { margin: 0; }

  .rarity-header {
    padding-left: var(--space-4);
    margin: var(--space-5) 0 var(--space-2);
    font-size: var(--text-body);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .catalog-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: var(--space-3);
  }

  .catalog-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: var(--space-3) var(--space-4);
    border: 1.5px solid;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--text-body);
    position: relative;
    text-align: left;
  }

  .catalog-card:hover { filter: brightness(0.95); }

  .sprite { width: 40px; height: 34px; image-rendering: pixelated; }
  .sprite-sm { width: var(--sprite-sm-width); height: var(--sprite-sm-height); image-rendering: pixelated; }
  .card-name { font-weight: 600; font-size: var(--text-body); }
  .card-stats { font-size: var(--text-detail); color: var(--color-text-secondary); }
  .card-ability {
    position: absolute;
    top: 2px;
    right: 4px;
    font-size: var(--text-xs);
    color: #c80;
  }

  .deck-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .deck-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-xs);
    font-size: var(--text-base);
  }

  .deck-name { flex: 1; font-weight: 500; }
  .deck-stats { color: var(--color-text-secondary); font-size: var(--text-sm); }

  .deck-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--space-5);
    gap: var(--space-4);
  }

  .deck-controls label {
    font-size: var(--text-base);
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  button {
    padding: 0.4rem 0.8rem;
    border-radius: var(--radius-xs);
    border: 1px solid var(--color-border-dark);
    background: var(--color-bg);
    cursor: pointer;
    font-size: var(--text-base);
  }

  button:hover { background: var(--color-bg-hover); }
  button:disabled { opacity: 0.4; cursor: default; }

  .small { font-size: var(--text-sm); padding: 0.2rem var(--space-4); }
  .tiny { font-size: var(--text-sm); padding: var(--space-1) var(--space-3); min-width: 1.5rem; }
  .tiny.remove { color: #c33; border-color: #c33; }
  .tiny.add { color: #3a3; border-color: #3a3; }

  /* Route stepper */
  .stats-bar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }

  .stat {
    text-align: center;
    padding: var(--space-4);
    background: var(--color-bg-subtle);
    border-radius: var(--radius-md);
  }

  .stat-label { font-size: var(--text-detail); color: var(--color-text-dim); display: block; }
  .stat-value { font-size: var(--text-xl); font-weight: 700; }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
    align-items: center;
  }

  .action-btn {
    padding: var(--space-4) 1.2rem;
    font-weight: 600;
    font-size: var(--text-md);
  }

  .action-btn.hit { background: var(--color-success-bg); border-color: var(--color-success); }
  .action-btn.hit:hover { background: #c8e6c9; }
  .action-btn.stop { background: #fff3e0; border-color: #ff9800; }
  .action-btn.stop:hover { background: #ffe0b2; }
  .action-btn.reset { background: var(--color-danger-bg); border-color: #e91e63; font-size: var(--text-sm); padding: 0.3rem 0.7rem; }

  .bust-msg { color: #c33; font-weight: 700; margin: 0; }

  .result p { margin: 0; }

  .drawn-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-bottom: var(--space-6);
  }

  .drawn-card {
    padding: 0.4rem 0.6rem;
    border: 1.5px solid;
    border-radius: var(--radius-md);
    font-size: var(--text-base);
  }

  .drawn-card-header {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  .drawn-num { color: var(--color-text-faint); font-size: var(--text-sm); }
  .drawn-card-stats { font-size: var(--text-sm); color: var(--color-text-secondary); }
  .drawn-card-types { font-size: var(--text-detail); color: var(--color-text-dim); }
  .drawn-card-desc { font-size: var(--text-detail); color: var(--color-text-dim); font-style: italic; display: block; }

  .draw-pile {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-6);
  }

  .pile-card {
    padding: var(--space-1) 0.4rem;
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    border: 1px solid var(--color-border);
  }

  .event-log {
    max-height: 200px;
    overflow-y: auto;
    font-size: var(--text-body);
    font-family: var(--font-mono);
  }

  .event { padding: var(--space-1) 0; color: var(--color-text-muted); }
  .event.ability { color: #c80; font-weight: 500; }
  .event.bust { color: #c33; font-weight: 700; }

  .hint { color: var(--color-text-faint); font-style: italic; font-size: var(--text-base); }
  .nav-link { font-size: var(--text-base); color: var(--color-text-muted); }

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
    padding: var(--space-4) 0.65rem;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: 400;
    font-style: normal;
    white-space: pre-line;
    width: max-content;
    max-width: 260px;
    z-index: 100;
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--duration-fast);
    line-height: 1.4;
    box-shadow: var(--shadow-md);
  }

  [data-tooltip]:hover::after {
    opacity: 1;
  }
</style>
