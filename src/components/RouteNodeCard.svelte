<script lang="ts">
  import type { RouteNode } from '../../engine/types';
  import { nodeTypeLabel } from '../../copy';

  let { node, selected = false, onclick }: {
    node: RouteNode;
    selected?: boolean;
    onclick?: () => void;
  } = $props();

  let content = $derived({
    name: node.name,
    typeLabel: nodeTypeLabel(node.type),
    bonus: node.bonus,
    mods: node.modifiers.length > 0 ? node.modifiers.map(m => m.description).join(', ') : null,
  });
</script>

{#snippet cardContent()}
  <strong>{content.name}</strong>
  <span class="node-type">{content.typeLabel}</span>
  {#if content.bonus}
    <span class="node-bonus">+ {content.bonus.replace('_', ' ')}</span>
  {/if}
  {#if content.mods}
    <span class="node-mods">{content.mods}</span>
  {/if}
{/snippet}

{#if onclick}
  <button class="vote-card interactive" class:selected onclick={onclick}>
    {@render cardContent()}
  </button>
{:else}
  <div class="vote-card" class:selected>
    {@render cardContent()}
  </div>
{/if}

<style>
  .vote-card { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-2); padding: var(--space-5) var(--space-6); border: 2px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-bg); width: 100%; text-align: left; font: inherit; color: inherit; }
  .vote-card.interactive { cursor: pointer; }
  .vote-card.interactive:hover { border-color: var(--color-text-dim); }
  .vote-card.selected { border-color: var(--color-primary); background: var(--color-primary-bg-light); }
  .node-type { font-size: var(--text-sm); text-transform: uppercase; color: var(--color-text-dim); }
  .node-bonus { font-size: var(--text-body); color: var(--color-success-confirmed); font-weight: 500; }
  .node-mods { font-size: var(--text-body); color: var(--color-text-muted); font-style: italic; }
</style>
