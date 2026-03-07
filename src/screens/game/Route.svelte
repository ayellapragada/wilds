<script lang="ts">
  import type { TVViewState, TrainerPublicInfo, TrailSpot } from '../../../engine/types';
  import { getTrailPosition } from '../../../engine/models/trail';
  import { copy } from '../../../copy';

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
    const result: TrailSpot[][] = [];
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
            <div class="spot" class:start={spot.index === 0}>
              <span class="vp">{spot.vp}</span>
              <div class="markers">
                {#each trainerPositions.get(spot.index) ?? [] as trainer}
                  <span
                    class="marker"
                    style="background: {trainerColor(trainerIndex(trainer))}"
                    title="{trainer.name}"
                  >{trainer.name[0]}</span>
                {/each}
              </div>
            </div>
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
        | {copy.cost.toLowerCase()}: {trainer.routeProgress.totalCost}/{gameState.currentRoute?.bustThreshold ?? '?'}
        | {copy.score.toLowerCase()}: {trainer.score}
      </div>
    {/each}
  </div>
</section>

<style>
  section { margin-bottom: 1.5rem; padding: 1rem; }
  h2 { margin-bottom: 1rem; }

  .trail { display: flex; flex-direction: column; gap: 2px; margin-bottom: 1.5rem; }
  .trail-row { display: flex; gap: 2px; }
  .trail-row.reversed { flex-direction: row-reverse; }

  .spot {
    width: 64px;
    height: 64px;
    border: 2px solid #8b9b6b;
    border-radius: 6px;
    background: #c8e6a0;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .spot.start { background: #a8d878; border-color: #5a8a3a; }

  .vp {
    position: absolute;
    top: 2px;
    right: 4px;
    font-size: 0.65rem;
    font-weight: bold;
    color: #4a6a2a;
  }

  .markers {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    justify-content: center;
  }

  .marker {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 0.7rem;
    font-weight: bold;
    border: 1px solid rgba(0,0,0,0.2);
  }

  .trainers { margin-top: 1rem; }
  .trainer-row { padding: 0.25rem 0; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem; }
  .trainer-dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
</style>
