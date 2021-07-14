<script>
  import Title from "./Title.svelte";
  export let expense = [];
</script>

<div class="main">
  {#each expense as item}
    <Title title={item.name} />
  {/each}
</div>
