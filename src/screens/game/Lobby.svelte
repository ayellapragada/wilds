<script lang="ts">
  import type { TVViewState, TrainerPublicInfo, Action } from '../../../engine/types';
  import { copy } from '../../../copy';
  import QRCode from 'qrcode';
  import Sprite from '../../components/Sprite.svelte';

  let { gameState, send }: {
    gameState: TVViewState;
    send: (action: Action) => void;
  } = $props();

  let trainerList = $derived(Object.values(gameState.trainers) as TrainerPublicInfo[]);
  let canAddBot = $derived(trainerList.length < gameState.settings.maxTrainers);
  let playerUrl = $derived(`${window.location.origin}${window.location.pathname}#/${gameState.roomCode}/player`);

  let qrDataUrl = $state('');
  let copied = $state(false);

  $effect(() => {
    QRCode.toDataURL(playerUrl, { width: 200, margin: 2 }).then((url: string) => {
      qrDataUrl = url;
    });
  });

  function copyUrl() {
    navigator.clipboard.writeText(playerUrl);
    copied = true;
    setTimeout(() => copied = false, 2000);
  }
</script>

<section>
  <h2>{copy.lobby}</h2>
  <div class="join-info">
    <p class="room-code">{copy.room}: <strong>{gameState.roomCode}</strong></p>
    {#if qrDataUrl}
      <img src={qrDataUrl} alt="QR code to join game" class="qr-code" />
    {/if}
    <button class="copy-url" onclick={copyUrl}>
      {copied ? '✓ Copied!' : 'Copy Room Link'}
    </button>
  </div>

  {#if trainerList.length > 0}
    <div class="trainer-list">
      <h3>{copy.trainers} ({trainerList.length})</h3>
      <div class="trainer-grid">
        {#each trainerList as trainer}
          <div class="trainer-chip">
            <div class="chip-avatar">
              <Sprite avatarId={trainer.avatar} scale={1} />
            </div>
            <span class="chip-name">{trainer.name}</span>
            {#if trainer.bot}
              <span class="bot-badge">{copy.botLabel}</span>
              <button class="remove-bot" onclick={() => send({ type: 'remove_bot', trainerId: trainer.id })}>{copy.removeBot}</button>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <p>{copy.waitingForTrainers}</p>
  {/if}

  <div class="bot-buttons">
    <button onclick={() => send({ type: 'add_bot', strategy: 'aggressive' })} disabled={!canAddBot}>{copy.addBotAggressive}</button>
    <button onclick={() => send({ type: 'add_bot', strategy: 'conservative' })} disabled={!canAddBot}>{copy.addBotConservative}</button>
    <button onclick={() => send({ type: 'add_bot', strategy: 'random' })} disabled={!canAddBot}>{copy.addBotRandom}</button>
  </div>
</section>

<style>
  section { margin-bottom: var(--space-7); padding: var(--space-6); border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
  .join-info { background: var(--color-primary-bg-lighter); padding: var(--space-6); border-radius: var(--radius-lg); margin-bottom: var(--space-6); text-align: center; }
  .room-code { font-size: var(--text-4xl); margin: 0; }
  .qr-code { margin: var(--space-6) auto; display: block; }
  .copy-url {
    display: inline-flex;
    align-items: center;
    gap: var(--space-4);
    background: white;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-md);
    padding: 0.4rem var(--space-5);
    cursor: pointer;
    font-family: inherit;
    font-size: var(--text-body);
    color: var(--color-text-muted);
    transition: border-color var(--duration-slow);
  }
  .copy-url:hover { border-color: var(--color-text-faint); background: #f5f5f5; }
  .trainer-list { margin-top: var(--space-6); }
  .trainer-grid { display: flex; flex-wrap: wrap; gap: var(--space-3); justify-content: center; margin-top: var(--space-4); }
  .trainer-chip {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--color-bg);
    border: 1px solid var(--color-border-light);
    border-radius: 999px;
    padding: var(--space-1) var(--space-4) var(--space-1) var(--space-1);
    font-size: var(--text-sm);
  }
  .chip-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--color-primary-bg-lighter);
    flex-shrink: 0;
    position: relative;
  }
  .chip-avatar > :global(.sprite) {
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%) scale(0.5);
    transform-origin: bottom center;
  }
  .chip-name { font-weight: 500; }
  .bot-badge { font-size: var(--text-xs); color: var(--color-text-muted); background: var(--color-bg-hover); border-radius: 999px; padding: 0 var(--space-2); }
  .remove-bot { padding: 0 var(--space-2); font-size: var(--text-xs); border: none; background: none; cursor: pointer; color: var(--color-text-muted); border-radius: 50%; line-height: 1; }
  .remove-bot:hover { background: var(--color-bg-hover); color: var(--color-text); }
  .bot-buttons { display: flex; gap: var(--space-3); justify-content: center; margin: var(--space-4) 0; flex-wrap: wrap; }
  .bot-buttons button { padding: var(--space-3) var(--space-5); font-size: var(--text-sm); border: 1px solid var(--color-border); border-radius: var(--radius-xs); background: var(--color-bg); cursor: pointer; }
  .bot-buttons button:hover { background: var(--color-bg-hover); }
  .bot-buttons button:disabled { opacity: 0.4; cursor: default; }
</style>
