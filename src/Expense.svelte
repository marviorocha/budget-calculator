<script>
  import { getContext } from "svelte";
  import { blur, fly, fade, slide, scale } from "svelte/transition";
  import { quadIn } from "svelte/easing";
  export let name = "";
  export let id;
  export let amount = null;

  // export let removeItem;
  let displayAmount = false;
  const { remove } = getContext("state");
  const setModifyExpense = getContext("modify");
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
      <button on:click={toggleAmount}
        ><i class="fas px-1 fa-caret-down text-blue-500" /></button
      >
    </h1>
    {#if displayAmount}
      <h3
        in:fly={{
          duration: 1000,
          x: 0,
          y: 50,
          delay: 50,
          easing: quadIn,
        }}
        out:fly
        class="text-base my-3 text-blue-500"
      >
        Amount: {amount}
      </h3>
    {/if}
  </div>

  <div class="expenses-buttons">
    <button on:click={() => setModifyExpense(id)}
      ><i class="fas px-2 fa-edit text-green-600" /></button
    >
    <button on:click={() => remove(id)}
      ><i class="fas fa-trash text-red-600" /></button
    >
  </div>
</article>
