<script lang="ts">
  import type { TVViewState, TrainerPublicInfo } from '../../../engine/types';
  import { copy } from '../../../copy';
  import QRCode from 'qrcode';

  let { gameState }: {
    gameState: TVViewState;
  } = $props();

  let trainerList = $derived(Object.values(gameState.trainers) as TrainerPublicInfo[]);
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
      {#each trainerList as trainer}
        <div class="trainer-row">
          {trainer.name}
          {#if trainer.bot}<span class="bot-badge">{copy.botLabel}</span>{/if}
        </div>
      {/each}
    </div>
  {:else}
    <p>{copy.waitingForTrainers}</p>
  {/if}
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
  .trainer-row { padding: var(--space-2) 0; font-size: var(--text-lg); }
  .bot-badge { font-size: var(--text-sm); color: var(--color-text-muted); margin-left: var(--space-2); }
</style>
