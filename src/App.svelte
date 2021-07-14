<script>
  import Navbar from "./Navbar.svelte";
  import Title from "./Title.svelte";
  import ExpenseList from "./ExpenseList.svelte"
  import ExpenseDate from "./expenses";
  let expenses = [...ExpenseDate];
  console.log(expenses);
</script>

<Navbar />
<main class="container mx-auto px-32 mt-5">
  <Title title="Add Expense" />
  
  <ExpenseList expense={expenses} />
 
</main>
