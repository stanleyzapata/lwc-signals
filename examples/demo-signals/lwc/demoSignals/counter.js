import { $signal, $effect, $computed, useLocalStorage } from "c/signals";

// EXAMPLE OF DEFAULT COUNTER

// export const counter = $signal(0);

// EXAMPLE OF COUNTER USING LOCAL STORAGE

export const counter = $signal(0, {
  storage: useLocalStorage("counter")
});

// EXAMPLE OF COUNTER USING COOKIES

// let tomorrow = new Date();
// tomorrow.setDate(tomorrow.getDate() + 1);

// export const counter = $signal(0, {
//   storage: useCookies("counter", tomorrow)
// });

$effect(() => console.log(counter.value));

export const counterPlusOne = $computed(() => counter.value + 1);
export const counterPlusTwo = $computed(() => counterPlusOne.value + 1);