<script lang="ts">
  import type { TVViewState, TrainerPublicInfo, TrailSpot as TrailSpotType } from '../../../engine/types';
  import { getTrailPosition } from '../../../engine/models/trail';
  import { copy } from '../../../copy';
  import TrailSpot from '../../components/TrailSpot.svelte';

  const SPOTS_PER_ROW = 8;
  const TRAINER_COLORS = ['#4a90d9', '#e85d75', '#50b86c', '#f5a623', '#9b59b6', '#1abc9c'];

  let { gameState }: {
    gameState: TVViewState;
  } = $props();

  let trail = $derived(gameState.currentRoute?.trail);
  let trainerList = $derived(Object.values(gameState.trainers) as TrainerPublicInfo[]);

  // Build rows for the snaking trail
  let rows = $derived.by(() => {
    if (!trail) return [];
    const result: TrailSpotType[][] = [];
    for (let i = 0; i < trail.spots.length; i += SPOTS_PER_ROW) {
      const row = trail.spots.slice(i, i + SPOTS_PER_ROW);
      const rowIndex = Math.floor(i / SPOTS_PER_ROW);
      // Even rows: left-to-right, odd rows: right-to-left (snaking)
      result.push(rowIndex % 2 === 1 ? [...row].reverse() : [...row]);
    }
    return result;
  });

  // Map trainer positions on the trail
  let trainerPositions = $derived.by(() => {
    if (!trail) return new Map<number, TrainerPublicInfo[]>();
    const positions = new Map<number, TrainerPublicInfo[]>();
    for (const trainer of trainerList) {
      if (trainer.status === 'waiting') continue;
      const pos = getTrailPosition(trail, trainer.routeProgress.totalDistance);
      if (!positions.has(pos)) positions.set(pos, []);
      positions.get(pos)!.push(trainer);
    }
    return positions;
  });

  function trainerColor(index: number): string {
    return TRAINER_COLORS[index % TRAINER_COLORS.length];
  }

  function trainerIndex(trainer: TrainerPublicInfo): number {
    return trainerList.indexOf(trainer);
  }
</script>

<section>
  <h2>{copy.route} {gameState.routeNumber} — {gameState.currentRoute?.name}</h2>

  {#if trail}
    <div class="trail">
      {#each rows as row, rowIdx}
        <div class="trail-row" class:reversed={rowIdx % 2 === 1}>
          {#each row as spot}
            <TrailSpot {spot} size={64} highlighted={spot.index === 0}>
              <div class="markers">
                {#each trainerPositions.get(spot.index) ?? [] as trainer}
                  <span
                    class="marker"
                    style="background: {trainerColor(trainerIndex(trainer))}"
                    title="{trainer.name}"
                  >{trainer.name[0]}</span>
                {/each}
              </div>
            </TrailSpot>
          {/each}
        </div>
      {/each}
    </div>
  {/if}

  <div class="trainers">
    {#each trainerList as trainer, i}
      <div class="trainer-row">
        <span class="trainer-dot" style="background: {trainerColor(i)}"></span>
        <strong>{trainer.name}</strong>
        — {trainer.status}
        | {copy.distance.toLowerCase()}: {trainer.routeProgress.totalDistance}
        | {copy.cost.toLowerCase()}: {trainer.routeProgress.totalCost}/{trainer.bustThreshold}
        | {copy.score.toLowerCase()}: {trainer.score}
      </div>
    {/each}
  </div>
</section>

<style>
  section { margin-bottom: var(--space-7); padding: var(--space-6); }
  h2 { margin-bottom: var(--space-6); }

  .trail { display: flex; flex-direction: column; gap: 2px; margin-bottom: var(--space-7); }
  .trail-row { display: flex; gap: 2px; }
  .trail-row.reversed { flex-direction: row-reverse; }

  .markers {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    justify-content: center;
  }

  .marker {
    width: var(--marker-size);
    height: var(--marker-size);
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: var(--text-detail);
    font-weight: bold;
    border: 1px solid rgba(0,0,0,0.2);
  }

  .trainers { margin-top: var(--space-6); }
  .trainer-row { padding: var(--space-2) 0; font-size: var(--text-md); display: flex; align-items: center; gap: var(--space-4); }
  .trainer-dot { width: var(--dot-size); height: var(--dot-size); border-radius: var(--radius-full); display: inline-block; flex-shrink: 0; }
</style>
