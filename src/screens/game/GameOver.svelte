<script lang="ts">
  import type { TVViewState, TrainerPublicInfo } from '../../../engine/types';
  import { copy } from '../../../copy';
  import Sprite from '../../components/Sprite.svelte';

  let { gameState }: { gameState: TVViewState } = $props();

  let sortedTrainers = $derived(
    (Object.values(gameState.trainers) as TrainerPublicInfo[])
      .sort((a, b) => b.score - a.score)
  );

  let revealedCount = $state(0);
  let showStats = $state(false);
  let showSuperlatives = $state(false);

  const revealTotal = sortedTrainers.length;
  $effect(() => {
    let count = 0;
    const interval = setInterval(() => {
      count++;
      revealedCount = count;
      if (count >= revealTotal) {
        clearInterval(interval);
        setTimeout(() => { showStats = true; }, 1000);
        setTimeout(() => { showSuperlatives = true; }, 2000);
      }
    }, 1000);
  });

  let superlativeMap = $derived.by(() => {
    const map = new Map<string, string>();
    for (const s of gameState.superlatives) {
      map.set(s.trainerId, s.award);
    }
    return map;
  });
</script>

<section>
  <h2>{copy.finalStandings}</h2>

  <div class="standings">
    {#each sortedTrainers.toReversed() as trainer, i}
      {@const rank = sortedTrainers.length - i}
      {@const isRevealed = i < revealedCount}
      {#if isRevealed}
        <div class="trainer-row reveal-in" class:champion={rank === 1}>
          <span class="rank">#{rank}</span>
          <Sprite avatarId={trainer.avatar} scale={rank === 1 ? 1 : 0.6} />
          <div class="trainer-info">
            <strong>{trainer.name}</strong>
            <span class="score">{trainer.score} {copy.score}</span>
            {#if showSuperlatives && superlativeMap.has(trainer.id)}
              <span class="superlative">{superlativeMap.get(trainer.id)}</span>
            {/if}
          </div>
          {#if showStats && trainer.stats}
            <div class="stats">
              <span>{copy.cardsDrawnLabel}: {trainer.stats.cardsDrawn}</span>
              <span>{copy.bustCountLabel}: {trainer.stats.bustCount}</span>
              <span>{copy.maxDistanceLabel}: {trainer.stats.maxRouteDistance}</span>
              <span>{copy.currencyEarnedLabel}: {trainer.stats.totalCurrencyEarned}</span>
            </div>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
</section>

<style>
  section { padding: var(--space-6); text-align: center; }
  .standings { display: flex; flex-direction: column-reverse; gap: var(--space-4); margin-top: var(--space-6); }
  .trainer-row {
    display: flex; align-items: center; gap: var(--space-4);
    padding: var(--space-4); border-radius: var(--radius-lg);
    background: var(--color-bg-muted);
    animation: reveal-slide 0.6s ease-out;
  }
  .trainer-row.champion {
    background: linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,215,0,0.05));
    border: 2px solid var(--color-gold);
    padding: var(--space-6);
  }
  .rank { font-size: var(--text-2xl); font-weight: bold; color: var(--color-text-dim); min-width: 2.5rem; }
  .trainer-info { display: flex; flex-direction: column; flex: 1; }
  .score { font-size: var(--text-lg); color: var(--color-text-secondary); }
  .superlative { font-size: var(--text-sm); color: var(--color-gold); font-style: italic; }
  .stats { display: flex; flex-direction: column; font-size: var(--text-sm); color: var(--color-text-dim); text-align: right; }
  @keyframes reveal-slide {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
</style>
