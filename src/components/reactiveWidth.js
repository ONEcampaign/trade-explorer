export let reactiveWidth = Math.min(window.innerWidth - 50, 1000);

window.addEventListener("resize", () => {
  reactiveWidth = Math.min(window.innerWidth - 50, 1000);
});