<script>
  import { onMount } from "svelte";
  import { blur, fade } from "svelte/transition";
  import { each } from "svelte/internal";
  import { async } from "validate.js";

  let person = [];
  let loaging = true;

  const personaData = async () => {
    let personData = await fetch(
      "https://randomuser.me/api/?page=3&results=50&seed=abc&nat=br"
    );
    let personGet = await personData.json();
    return personGet["results"];
  };
</script>

<div class="containe mx-auto">
  <div class=" min-h-screen py-32 px-10 ">
    <div
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 md:gap-x-10 xl-grid-cols-4 gap-y-10 gap-x-6 "
    >
      {#await personaData()}
        <h1 class="text-2xl">
          <i class="fas fa-spinner fa-pulse " /> Loaging ...
        </h1>
      {:then person}
        {#each person as people}
          <div
            class="container mx-auto shadow-lg rounded-lg max-w-md hover:shadow-2xl transition duration-300"
          >
            <img
              in:blur={{ delay: 200 }}
              out:fade
              src={people.picture.large}
              alt={people.name.first}
              class="rounded-t-lg w-full"
            />
            <div class="p-6">
              <h1
                class="md:text-1xl text-xl hover:text-indigo-600 transition duration-200  font-bold text-gray-900 "
              >
                {people.name.first}
                {people.name.last}
              </h1>
              <p class="text-gray-700 my-2 hover-text-900 ">
                <button>{people.location}</button>
              </p>
            </div>
          </div>
        {/each}
      {:catch error}
        <h1 class="text-2xl">Não foi possível carregar o conteúdo!</h1>
      {/await}
    </div>
  </div>
</div>
