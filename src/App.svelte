<script>
  import { setContext, onMount, afterUpdate } from "svelte";
  import Navbar from "./Navbar.svelte";
  import Title from "./Title.svelte";
  import Totals from "./Total.svelte";
  import ExpenseList from "./ExpenseList.svelte";
  import ExpenseDate from "./expenses";
  import ExpenseForm from "./ExpenseForm.svelte";
  import Modal from "./Modal.svelte";
  // variable
  let expenses = [];
  let isShowForm = false;

  // Variable Editing
  export let setId = null;
  export let setName = "";
  export let setAmount = null;
  // reactive
  $: isEditing = setId ? true : false;

  $: total = expenses.reduce((acc, curr) => {
    return (acc += JSON.parse(curr.amount));
  }, 0);

  // Show form

  const formOpen = () => {
    isShowForm = true;
  };

  const formClose = () => {
    isShowForm = false;
    setId = null;
    setName = "";
    setAmount = null;
  };

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
    setId = expense.id;
    setName = expense.name;
    setAmount = expense.amount;
    formOpen();
  };

  // Edit expense

  const editExpense = ({ title, amount }) => {
    expenses = expenses.map((item) => {
      return item.id === setId ? { ...item, name: title, amount } : { ...item };
    });
    setId = null;
    setName = "";
    setAmount = null;
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

  //  Set localStorage

  const setlocalStorage = () => {
    localStorage.setItem("expenses", JSON.stringify(expenses));
  };

  onMount(() => {
    expenses = localStorage.getItem("expenses")
      ? JSON.parse(localStorage.getItem("expenses"))
      : [];
  });

  afterUpdate(() => {
    setlocalStorage();
  });
</script>

<Navbar {formOpen} />
<main class="container  mx-auto px-32 mt-5">
  {#if isShowForm}
    <Modal>
      <ExpenseForm
        {addExpense}
        {editExpense}
        title={setName}
        amount={setAmount}
        {isEditing}
        {formClose}
      />
    </Modal>
  {/if}
  <Totals {total} />

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
