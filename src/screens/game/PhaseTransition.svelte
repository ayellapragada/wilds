<script lang="ts">
  let { text }: { text: string } = $props();
</script>

<div class="transition">
  <span class="transition-text">{text}</span>
</div>

<style>
  .transition {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    animation: transition-fade 1.5s ease-in-out forwards;
  }
  .transition-text {
    font-size: 2rem;
    font-weight: bold;
    color: var(--color-text);
    opacity: 0;
    animation: text-appear 1.5s ease-in-out forwards;
  }
  @keyframes text-appear {
    0% { opacity: 0; transform: translateY(10px); }
    20% { opacity: 1; transform: translateY(0); }
    80% { opacity: 1; }
    100% { opacity: 0; }
  }
</style>
