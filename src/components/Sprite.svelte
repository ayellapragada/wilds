<script lang="ts">
  import { FRAME_WIDTH, FRAME_HEIGHT, SHEET_URL, getFramePosition } from '../lib/avatars';

  let { avatarId, scale = 3 }: {
    avatarId: number;
    scale?: number;
  } = $props();

  let pos = $derived(getFramePosition(avatarId));
  let w = $derived(FRAME_WIDTH * scale);
  let h = $derived(FRAME_HEIGHT * scale);
  let sheetW = $derived(FRAME_WIDTH * 38 * scale);
  let sheetH = $derived(FRAME_HEIGHT * scale);
  let bgX = $derived(-pos.x * scale);
  let bgY = $derived(-pos.y * scale);
</script>

<div
  class="sprite"
  style="width: {w}px; height: {h}px; background-image: url({SHEET_URL}); background-position: {bgX}px {bgY}px; background-size: {sheetW}px {sheetH}px;"
></div>

<style>
  .sprite {
    image-rendering: pixelated;
    display: inline-block;
  }
</style>
