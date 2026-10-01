// The served URL determines language; preferences only follow explicit navigation.
for (const link of document.querySelectorAll('[data-lang]')) {
  link.setAttribute('aria-current', link.dataset.lang === document.documentElement.lang ? 'page' : 'false');
  link.addEventListener('click', () => {try {localStorage.setItem('lc.lang', link.dataset.lang);} catch {}});
}
