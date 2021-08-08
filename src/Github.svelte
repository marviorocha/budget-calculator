<script>
  import { onMount } from "svelte";
  import { each } from "svelte/internal";
  import { async } from "validate.js";

  let user = [];
  let loaging = true;

  onMount(async () => {
    let userData = await fetch("https://api.github.com/users");
    let gitHubUser = await userData.json();
    user = gitHubUser;
    loaging = false;
  });
</script>

<div class="containe mx-auto">
  {#if loaging}
    <h1 class="text-2xl">
      <i class="fas fa-spinner fa-pulse " /> Loaging ...
    </h1>
  {:else}
    <div class=" min-h-screen py-32 px-10 ">
      <div
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 md:gap-x-10 xl-grid-cols-4 gap-y-10 gap-x-6 "
      >
        {#each user as users}
          <div
            class="container mx-auto shadow-lg rounded-lg max-w-md hover:shadow-2xl transition duration-300"
          >
            <img
              src={users.avatar_url}
              alt={users.login}
              class="rounded-t-lg w-full"
            />
            <div class="p-6">
              <h1
                class="md:text-1xl text-xl hover:text-indigo-600 transition duration-200  font-bold text-gray-900 "
              >
                <a target="_blank" href={users.html_url}>{users.html_url}</a>.
              </h1>
              <p class="text-gray-700 my-2 hover-text-900 ">
                <button>{users.login}</button>
              </p>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
