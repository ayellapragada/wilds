<script lang="ts">
  import { resolveAction } from '../../engine/action-resolver';
  import { createTVView } from '../../engine/views';
  import type { Action, GameState, GameEvent, TVViewState } from '../../engine/types';
  import type { Preset, PresetPhase } from './presets';
  import { presets } from './presets';
  import GameScreen from '../screens/game/GameScreen.svelte';

  const phases: PresetPhase[] = ['lobby', 'route', 'hub', 'world'];

  let activePhase = $state<PresetPhase>('lobby');
  let activePresetIndex = $state(0);
  let rawState = $state<GameState>(presets['lobby'][0].state);
  let tvView = $derived<TVViewState>(createTVView(rawState));
  let events = $state<GameEvent[]>([]);
  let logOpen = $state(false);

  let phasePresets = $derived<Preset[]>(presets[activePhase] ?? []);

  function selectPhase(phase: PresetPhase) {
    activePhase = phase;
    activePresetIndex = 0;
    applyPreset(0);
  }

  function selectPreset(index: number) {
    activePresetIndex = index;
    applyPreset(index);
  }

  function applyPreset(index: number) {
    const preset = (presets[activePhase] ?? [])[index];
    if (!preset) return;
    // Deep clone the state so mutations don't affect the original preset
    rawState = JSON.parse(JSON.stringify(preset.state));
    events = [];
  }

  function send(action: Action) {
    try {
      const [newState, newEvents] = resolveAction(rawState, action);
      rawState = newState;
      events = [...newEvents, ...events];
    } catch (e) {
      console.error('PreviewShell: action failed', action, e);
    }
  }

  function formatEvent(event: GameEvent): string {
    return JSON.stringify(event);
  }
</script>

<div class="preview-shell">
  <!-- Phase tabs -->
  <nav class="phase-tabs">
    {#each phases as phase}
      <button
        class="phase-tab"
        class:active={activePhase === phase}
        onclick={() => selectPhase(phase)}
      >
        {phase}
      </button>
    {/each}
  </nav>

  <!-- Preset buttons -->
  <div class="preset-bar">
    {#each phasePresets as preset, i}
      <button
        class="preset-btn"
        class:active={activePresetIndex === i}
        onclick={() => selectPreset(i)}
        title={preset.description}
      >
        {preset.label}
      </button>
    {/each}
  </div>

  <!-- Game screen -->
  <div class="preview-area">
    <GameScreen gameState={tvView} />
  </div>

  <!-- Event log (collapsed by default) -->
  <details class="event-log-details" bind:open={logOpen}>
    <summary>Event Log ({events.length})</summary>
    <div class="event-log">
      {#each events as event}
        <div class="event-entry">{formatEvent(event)}</div>
      {/each}
      {#if events.length === 0}
        <p class="hint">No events yet. Interact with the preview to generate events.</p>
      {/if}
    </div>
  </details>
</div>

<style>
  .preview-shell {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .phase-tabs {
    display: flex;
    gap: 0;
    border-bottom: 2px solid var(--color-border-light);
  }

  .phase-tab {
    padding: var(--space-4) 1.2rem;
    border: none;
    background: none;
    cursor: pointer;
    font-size: var(--text-md);
    font-weight: 500;
    text-transform: capitalize;
    color: var(--color-text-muted);
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    transition: color var(--duration-normal), border-color var(--duration-normal);
  }

  .phase-tab:hover {
    color: var(--color-text);
  }

  .phase-tab.active {
    color: var(--color-accent);
    border-bottom-color: var(--color-accent);
  }

  .preset-bar {
    display: flex;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .preset-btn {
    padding: var(--space-3) var(--space-5);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-subtle);
    cursor: pointer;
    font-size: 0.8rem;
    transition: background var(--duration-normal), border-color var(--duration-normal);
  }

  .preset-btn:hover {
    background: var(--color-bg-hover);
  }

  .preset-btn.active {
    background: var(--color-primary-bg);
    border-color: var(--color-accent);
    color: var(--color-accent);
    font-weight: 600;
  }

  .preview-area {
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    min-height: 300px;
  }

  .event-log-details {
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-lg);
    padding: var(--space-4) var(--space-5);
  }

  .event-log-details summary {
    cursor: pointer;
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--color-text-muted);
  }

  .event-log {
    max-height: 250px;
    overflow-y: auto;
    font-size: var(--text-sm);
    font-family: var(--font-mono);
    margin-top: var(--space-4);
  }

  .event-entry {
    padding: var(--space-1) 0;
    color: var(--color-text-secondary);
    border-bottom: 1px solid var(--color-bg-muted);
    word-break: break-all;
  }

  .hint {
    color: var(--color-text-faint);
    font-style: italic;
    font-size: var(--text-base);
  }
</style>
