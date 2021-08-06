<script>
  import { setContext } from "svelte";
  import Navbar from "./Navbar.svelte";
  import Title from "./Title.svelte";
  import Total from "./Total.svelte";
  import ExpenseList from "./ExpenseList.svelte";
  import ExpenseDate from "./expenses";
  import ExpenseForm from "./ExpenseForm.svelte";

  // variable
  let expenses = [...ExpenseDate];

  // reactive
  $: total = expenses.reduce((acumulate, curr) => {
    return (acumulate += curr.amount);
  }, 0);

  // Add Expense
  const addExpense = ({ title, amount }) => {
    let expense = {
      id: Math.random() * Date.now(),
      name: title,
      amount,
    };
    expenses = [expense, ...expenses];
  };

  // Modified Expense
  const modifiedExpense = (id) => {
    let expense = expenses.find((item) => item.id === id);
    console.log(expense);
    setId = expense.id;
    setTitle = expense.title;
    setAmount = expense.amount;
  };

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
  setContext("modify", modifiedExpense);
</script>

<Navbar />
<main class="container  mx-auto px-32 mt-5">
  <ExpenseForm {addExpense} />

  <Total {total} />

  <Title title="Add Expense" />

  <ExpenseList {expenses} />

  <div class="flex justify-center">
    <button
      on:click={clearExpensesAll}
      class="w-2/4  py-2 rounded-md  blue bg-blue-500 hover:bg-blue-800 transition delay-200  text-white my-3"
      >Clear all expense</button
    >
  </div>
</main>

<style global>
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
</style>
