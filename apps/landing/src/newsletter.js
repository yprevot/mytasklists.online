/**
 * Alta en el boletín. El backend la reenvía a Listmonk, que manda el correo de
 * confirmación (doble opt-in). La sección se queda oculta si el boletín no está
 * configurado en el servidor.
 */
(() => {
  const section = document.querySelector('[data-newsletter]');
  if (!section) return;
  const form = section.querySelector('form');
  const output = form.querySelector('.newsletter-msg');
  const button = form.querySelector('button[type="submit"]');

  fetch('/api/newsletter', { headers: { Accept: 'application/json' } })
    .then((response) => (response.ok ? response.json() : null))
    .then((status) => {
      if (status && status.enabled) section.hidden = false;
    })
    .catch(() => undefined);

  // Los textos viven en el HTML (data-msg) para que i18n.js los traduzca
  const say = (key) => {
    const source = form.querySelector(`[data-msg="${key}"]`);
    output.textContent = source ? source.textContent.trim() : '';
    output.dataset.tone = key === 'ok' ? 'ok' : 'error';
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = form.elements.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      say('invalid');
      form.elements.email.focus();
      return;
    }
    button.disabled = true;
    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Language': document.documentElement.lang },
        body: JSON.stringify({ email }),
      });
      if (response.ok) {
        form.reset();
        say('ok');
      } else {
        say(response.status === 400 ? 'invalid' : 'error');
      }
    } catch {
      say('error');
    } finally {
      button.disabled = false;
    }
  });
})();
