<script lang="ts">
  import type { TVViewState, TrainerPublicInfo, TrailSpot as TrailSpotType } from '../../../engine/types';
  import { getTrailPosition } from '../../../engine/models/trail';
  import { copy } from '../../../copy';
  import TrailSpot from '../../components/TrailSpot.svelte';
  import Sprite from '../../components/Sprite.svelte';

  const SPOTS_PER_ROW = 8;
  const SPRITE_SCALE = 0.5;

  let { gameState }: {
    gameState: TVViewState;
  } = $props();

  let route = $derived(gameState.currentRoute!);
  let trail = $derived(route.trail);
  let trainerList = $derived(Object.values(gameState.trainers) as TrainerPublicInfo[]);

  // Build rows for the snaking trail
  let rows = $derived.by(() => {
    const result: TrailSpotType[][] = [];
    for (let i = 0; i < trail.spots.length; i += SPOTS_PER_ROW) {
      const row = trail.spots.slice(i, i + SPOTS_PER_ROW);
      const rowIndex = Math.floor(i / SPOTS_PER_ROW);
      result.push(rowIndex % 2 === 1 ? [...row].reverse() : [...row]);
    }
    return result;
  });

  // DOM refs for measuring spot positions
  let trailEl: HTMLDivElement;
  let spotEls = new Map<number, HTMLDivElement>();
  let spotPositions = $state(new Map<number, { x: number; y: number; w: number; h: number }>());

  function measureSpots() {
    if (!trailEl) return;
    const trailRect = trailEl.getBoundingClientRect();
    const next = new Map<number, { x: number; y: number; w: number; h: number }>();
    for (const [idx, el] of spotEls) {
      const r = el.getBoundingClientRect();
      next.set(idx, {
        x: r.left - trailRect.left,
        y: r.top - trailRect.top,
        w: r.width,
        h: r.height,
      });
    }
    spotPositions = next;
  }

  $effect(() => {
    // Re-measure whenever trail changes
    trail;
    // Tick to let DOM render, then measure
    requestAnimationFrame(measureSpots);
  });

  // Build marker list with positions from measured DOM
  let trainerMarkers = $derived.by(() => {
    const bySpot = new Map<number, number>();
    const markers: { trainer: TrainerPublicInfo; idx: number; x: number; y: number }[] = [];
    const markerSize = 54 * SPRITE_SCALE;

    for (const trainer of trainerList) {
      if (trainer.status === 'waiting') continue;
      const distance = trainer.finalRouteDistance ?? trainer.routeProgress.totalDistance;
      const pos = getTrailPosition(trail, distance);
      const idx = trainerList.indexOf(trainer);
      const countAtSpot = bySpot.get(pos) ?? 0;
      bySpot.set(pos, countAtSpot + 1);

      const rect = spotPositions.get(pos);
      if (!rect) continue;
      const centerX = rect.x + (rect.w - markerSize) / 2 + countAtSpot * (markerSize / 2);
      const centerY = rect.y + (rect.h - markerSize) / 2;
      markers.push({ trainer, idx, x: centerX, y: centerY });
    }
    return markers;
  });

  function registerSpot(el: HTMLDivElement, index: number) {
    spotEls.set(index, el);
    measureSpots();
    return {
      destroy() { spotEls.delete(index); }
    };
  }
</script>

<section>
  <h2>{copy.route} {gameState.routeNumber} — {route.name}</h2>

  <div class="trail" bind:this={trailEl}>
      {#each rows as row, rowIdx}
        <div class="trail-row" class:reversed={rowIdx % 2 === 1}>
          {#each row as spot}
            <div use:registerSpot={spot.index}>
              <TrailSpot {spot} highlighted={spot.index === 0} />
            </div>
          {/each}
        </div>
      {/each}

      {#each trainerMarkers as { trainer, idx, x, y } (trainer.name)}
        <span
          class="marker"
          style="transform: translate({x}px, {y}px);"
          title={trainer.name}
        ><Sprite avatarId={trainer.avatar} scale={SPRITE_SCALE} /></span>
      {/each}
  </div>

  <div class="trainers">
    {#each trainerList as trainer, i}
      <div class="trainer-row">
        <Sprite avatarId={trainer.avatar} scale={0.5} />
        <strong>{trainer.name}</strong>
        — {trainer.status}
        | {copy.distance.toLowerCase()}: {trainer.finalRouteDistance ?? trainer.routeProgress.totalDistance}
        | {copy.cost.toLowerCase()}: {trainer.finalRouteCost ?? trainer.routeProgress.totalCost}/{trainer.bustThreshold}
        | {copy.score.toLowerCase()}: {trainer.score}
      </div>
    {/each}
  </div>
</section>

<style>
  section { margin-bottom: var(--space-7); padding: var(--space-6); }
  h2 { margin-bottom: var(--space-6); }

  .trail { display: flex; flex-direction: column; gap: 2px; margin-bottom: var(--space-7); position: relative; }
  .trail-row { display: flex; gap: 2px; }
  .trail-row.reversed { flex-direction: row-reverse; }
  .marker {
    position: absolute;
    top: 0;
    left: 0;
    transition: transform 600ms ease-out;
    z-index: 1;
    pointer-events: none;
  }

  .trainers { margin-top: var(--space-6); }
  .trainer-row { padding: var(--space-2) 0; font-size: var(--text-md); display: flex; align-items: center; gap: var(--space-4); }
</style>
