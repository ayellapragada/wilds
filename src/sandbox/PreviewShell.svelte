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
    gap: 0.75rem;
  }

  .phase-tabs {
    display: flex;
    gap: 0;
    border-bottom: 2px solid #ddd;
  }

  .phase-tab {
    padding: 0.5rem 1.2rem;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    text-transform: capitalize;
    color: #666;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    transition: color 0.15s, border-color 0.15s;
  }

  .phase-tab:hover {
    color: #333;
  }

  .phase-tab.active {
    color: #2563eb;
    border-bottom-color: #2563eb;
  }

  .preset-bar {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .preset-btn {
    padding: 0.35rem 0.75rem;
    border: 1px solid #ccc;
    border-radius: 6px;
    background: #f8f8f8;
    cursor: pointer;
    font-size: 0.8rem;
    transition: background 0.15s, border-color 0.15s;
  }

  .preset-btn:hover {
    background: #eee;
  }

  .preset-btn.active {
    background: #e0edff;
    border-color: #2563eb;
    color: #2563eb;
    font-weight: 600;
  }

  .preview-area {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 1rem;
    min-height: 300px;
  }

  .event-log-details {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
  }

  .event-log-details summary {
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    color: #666;
  }

  .event-log {
    max-height: 250px;
    overflow-y: auto;
    font-size: 0.75rem;
    font-family: monospace;
    margin-top: 0.5rem;
  }

  .event-entry {
    padding: 0.15rem 0;
    color: #555;
    border-bottom: 1px solid #f0f0f0;
    word-break: break-all;
  }

  .hint {
    color: #999;
    font-style: italic;
    font-size: 0.85rem;
  }
</style>
