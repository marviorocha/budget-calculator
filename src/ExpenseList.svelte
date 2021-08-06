<script>
  import Title from "./Title.svelte";
  import Expense from "./Expense.svelte";
  export let expenses = [];
  
</script>

<section>
  <Title title="List Expense" />
  {#each expenses as expenses, index}
    <Expense {...expenses} />
  {:else}
    <h1 class="text-xl font-bold text-center">Current is not have expenses</h1>
  {/each}
</section>
