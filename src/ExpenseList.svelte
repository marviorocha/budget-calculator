<script>
  import Title from "./Title.svelte";
  import Expense from "./Expense.svelte";
  import { fly } from "svelte/transition";
  import { flip } from "svelte/animate";
  export let expenses = [];
</script>

<section>
  <Title title="List Expense" />
  {#each expenses as expenses, index (expenses.id)}
    <div
      in:fly={{ x: 200, delay: (index + 1) * 500 }}
      out:fly={{ x: -200 }}
      animate:flip
    >
      <Expense {...expenses} />
    </div>
  {:else}
    <h1 class="text-xl font-bold text-center">Current is not have expenses</h1>
  {/each}
</section>
