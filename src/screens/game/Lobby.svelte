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
        <div class="trainer-row">{trainer.name}</div>
      {/each}
    </div>
  {:else}
    <p>{copy.waitingForTrainers}</p>
  {/if}
</section>

<style>
  section { margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #ccc; border-radius: 8px; }
  .join-info { background: #f0f8ff; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; text-align: center; }
  .room-code { font-size: 2rem; margin: 0; }
  .qr-code { margin: 1rem auto; display: block; }
  .copy-url {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 0.4rem 0.75rem;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8rem;
    color: #666;
    transition: border-color 0.2s;
  }
  .copy-url:hover { border-color: #999; background: #f5f5f5; }
  .trainer-list { margin-top: 1rem; }
  .trainer-row { padding: 0.25rem 0; font-size: 1rem; }
</style>
