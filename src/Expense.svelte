<script>
  import { getContext } from "svelte";

  export let name = "";
  export let id;
  export let amount = 0;
  // export let removeItem;
  let displayAmount = false;
  const { remove } = getContext("state");
  const toggleAmount = () => {
    displayAmount = !displayAmount;
  };

 
</script>

<article
  class="p-3 flex justify-between items-center bg-gray-100 rounded-md my-2 shadow-sm "
>
  <div class="expenses-info">
    <h1 class="text-1xl font-bold capitalize">
      {name}
      <button on:click|once={toggleAmount}
        ><i class="fas px-1 fa-caret-down text-blue-500" /></button
      >
    </h1>
    {#if displayAmount}
      <h3 class="text-base my-3 text-blue-500">Amount: ${amount}</h3>
    {/if}
  </div>

  <div class="expenses-buttons">
    <button><i class="fas px-2 fa-edit text-green-600" /></button>
    <button on:click={() => remove(id)}
      ><i class="fas fa-trash text-red-600" /></button
    >
 
  </div>
</article>
