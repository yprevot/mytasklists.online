/**
 * Demostración del teléfono del hero: el pan de caja se marca como comprado y
 * su etiqueta pasa de "cada 14 d" a "vuelve en 14 d"; después vuelve a empezar.
 * Con "reducir movimiento" la escena se queda quieta.
 */
(() => {
  const row = document.querySelector('[data-demo-row]');
  if (!row || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let timer = 0;
  const step = (done) => {
    row.classList.toggle('is-done', done);
    timer = window.setTimeout(() => step(!done), done ? 3400 : 2600);
  };

  timer = window.setTimeout(() => step(true), 1800);

  // Sin pestaña a la vista no hace falta animar
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      window.clearTimeout(timer);
    } else {
      step(false);
    }
  });
})();
