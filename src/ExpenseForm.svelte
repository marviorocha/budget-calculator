<script>
  import Validate from "validate.js";
  import Title from "./Title.svelte";
  export let title = "";
  export let amount = null;
  export let isEditing;
  export let formClose;
  export let editExpense;
  $: emptyValue = !title || !amount;
  export let addExpense;
  const handleSubmit = () => {
    if (isEditing) {
      editExpense({ title, amount });
    } else {
      addExpense({ title, amount });
    }

    title = "";
    amount = null;
  };
</script>

<section
  class="bg-gray-100 shadow-lg rounded-md my-2 block mx-auto w-1/3 py-3  shadow-sm"
>
  <form action="" class="my-5 px-5" on:submit|preventDefault={handleSubmit}>
    <button
      on:click={formClose}
      class="focus:outline-none text-red-600 float-right"
    >
      <i class="fas fa-times" /> Close</button
    >
    <Title title="Add Expense" />
    <div class="flex flex-col">
      <label for="name" class="font-bold">Title:</label>
      <input
        type="text"
        bind:value={title}
        name="title"
        class="px-1 py-1 focus:outline-none border-b-2 border-0 mb-3 focus:ring-0 bg-gray-100 w-full"
      />
      <label for="name" class="font-bold">Price:</label>
      <input
        type="text"
        name="amount"
        bind:value={amount}
        class="px-1 py-1 focus:outline-none border-b-2 border-0 bg-gray-100 focus:ring-0 w-full"
      />
      {#if emptyValue}
        <p class="text-red-500 mx-auto py-3">Please fill all field this form</p>
      {/if}

      <button
        type="submit"
        class:disable={emptyValue}
        class="w-auto py-2  rounded-md border-2 blue uppercase border-blue-600 bg-write hover:bg-blue-500 hover:text-white transition delay-200  text-blue-600 my-3"
        >{#if isEditing} Edite Expense {:else} Add Expense {/if}</button
      >
    </div>
  </form>
</section>

<style>
  .disable {
    background-color: #b3b0b0;
    color: lightslategray;
    border-color: rgb(179, 177, 177);
  }
  .disable:hover {
    background-color: #b3b0b0;
    color: lightslategray;
    border-color: rgb(179, 177, 177);
  }
</style>
