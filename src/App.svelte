<script>
  import { setContext } from "svelte";
  import Navbar from "./Navbar.svelte";
  import Title from "./Title.svelte";
  import ExpenseList from "./ExpenseList.svelte";
  import ExpenseDate from "./expenses";

  let expenses = [...ExpenseDate];

  const removeItem = (id) => {
    expenses = expenses.filter((item) => item.id !== id);
  };
  const state = {
    name: "simple name here",
    remove: removeItem,
  };

  const clearExpensesAll = () => {
    expenses = [];
  };
  setContext("state", state);
</script>

<Navbar />
<main class="container  mx-auto px-32 mt-5">
  <Title title="Add Expense" />

  <ExpenseList {expenses} />
  <div class="flex justify-center">
    <button on:click={clearExpensesAll}
      class="w-2/4  py-2 rounded-md  blue bg-blue-500 hover:bg-blue-800 transition delay-200  text-white my-3"
      >Clear all expense</button
    >
  </div>
</main>
