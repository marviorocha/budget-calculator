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

  const deleteButton = (event) => {
     const {id, name} = event.detail;
     confirm(name)
     removeItem(id)
  }
  setContext("state", state);
</script>

<Navbar />
<main class="container mx-auto px-32 mt-5">
  <Title title="Add Expense" />

  <ExpenseList {expenses} on:remove={deleteButton} />
</main>
