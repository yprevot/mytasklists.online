/**
 * Idioma de la landing. El HTML esta en espanol (lo que indexan los buscadores);
 * este script lo cambia a ingles cuando el navegador lo prefiere o la persona lo
 * elige. La eleccion se guarda en `lc.lang`, la misma clave que usan la app web y
 * el panel, asi que se conserva al pasar de uno a otro.
 */
(() => {
  const STORAGE_KEY = 'lc.lang';
  const LANGUAGES = ['es', 'en'];

  const EN = {
    'meta.title': 'ListaDeCompras · Shared lists with recurring items',
    'meta.description':
      'Create shopping lists, share them with anyone and let the items you always buy add themselves back every so often. Available for iOS, Android and the web.',
    'nav.features': 'Features',
    'nav.how': 'How it works',
    'nav.download': 'Download',
    'nav.openApp': 'Open web app',
    'hero.title': 'Your pantry, always up to date.\n<span class="hl">Never forget the bread again.</span>',
    'hero.lede':
      'Create shopping lists, share them with your family and check off what you already bought. Recurring items come back to the list on their own when it is time, and if someone else edits it you see it instantly.',
    'hero.note': 'You can also use it in the browser · <a href="__APP_URL__">open the web version</a>',
    'store.iosSmall': 'Download on the',
    'store.androidSmall': 'Get it on',
    'store.for': 'Download for',
    'store.iphone': 'iPhone and iPad',
    'mock.list': 'Weekly groceries',
    'mock.live': 'Ana and Carlos · live',
    'mock.pending': 'To buy',
    'mock.bread': 'Sliced bread',
    'mock.every': 'every 14 d',
    'mock.returns': 'back in 14 d',
    'mock.milk': 'Whole milk',
    'mock.overdue': 'overdue',
    'mock.batteries': 'AA batteries',
    'mock.bought': 'Bought',
    'mock.coffee': 'Ground coffee',
    'features.title': 'Built for what you really buy every week',
    'features.text': 'It is not another to-do list: it knows some things you buy once and others you buy all the time.',
    'features.recurring.title': 'Recurring items',
    'features.recurring.text':
      'Add "Sliced bread" to repeat every 14 days. When you check it off, the clock starts from that moment and the item comes back to the list on its own.',
    'features.color.title': 'Color alerts',
    'features.color.text':
      'If a recurring item goes unbought past its deadline, it changes color so it stands out without having to look for it.',
    'features.check.title': 'Checklist style',
    'features.check.text':
      'Bought items move to a second list, crossed out. They stay there until you close them with the "x", just like Google lists.',
    'features.shared.title': 'Shared lists',
    'features.shared.text': 'Invite anyone by email. Everyone can add items and check off what they already bought.',
    'features.realtime.title': 'Real time',
    'features.realtime.text':
      'If your partner checks off the milk at the store, your list updates instantly. No more buying the same thing twice.',
    'features.alerts.title': 'Alerts your way',
    'features.alerts.text':
      'Everyone decides whether they want to know: a pop-up on the web and a push notification on iOS and Android.',
    'how.title': 'An example: sliced bread',
    'how.text': 'This is how recurrence works, told with a real case.',
    'how.step1.title': 'On Monday you add "Sliced bread" to repeat every 14 days',
    'how.step1.text': 'It goes onto the to-buy list and its deadline starts running.',
    'how.step2.title': 'On Friday you go to the store and check it off',
    'how.step2.text':
      'It moves, crossed out, to the bought list. The 14 days start counting from that Friday, not from Monday.',
    'how.step3.title': 'Fourteen days later it comes back to "To buy" on its own',
    'how.step3.text': 'Along with a notification so it does not catch you off guard. Cycle after cycle.',
    'how.step4.title': 'Forgot to buy it?',
    'how.step4.text': 'The item stays on the list but changes color to let you know its deadline has passed.',
    'cta.title': 'Download the app',
    'cta.text':
      'Available for iPhone and Android. Create your account with email, Google or Apple and start sharing your lists in under a minute.',
    'footer.tagline': '© __YEAR__ ListaDeCompras · Made so you never forget the milk again.',
    'footer.app': 'Web app',
    'footer.panel': 'Admin panel',
  };

  const nodes = Array.from(document.querySelectorAll('[data-i18n]'));
  const description = document.querySelector('meta[name="description"]');
  const original = {
    title: document.title,
    description: description ? description.getAttribute('content') : '',
    html: new Map(nodes.map((node) => [node, node.innerHTML])),
  };

  const detect = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (LANGUAGES.includes(stored)) return stored;
    } catch {
      /* almacenamiento no disponible */
    }
    const preferred = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    for (const tag of preferred) {
      const base = String(tag || '').toLowerCase().split('-')[0];
      if (LANGUAGES.includes(base)) return base;
    }
    return 'en';
  };

  const apply = (language) => {
    const english = language === 'en';
    document.documentElement.lang = language;
    document.title = english ? EN['meta.title'] : original.title;
    if (description) description.setAttribute('content', english ? EN['meta.description'] : original.description);
    for (const node of nodes) {
      const key = node.getAttribute('data-i18n');
      node.innerHTML = english && EN[key] ? EN[key] : original.html.get(node);
    }
    for (const button of document.querySelectorAll('[data-lang]')) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-lang') === language));
    }
  };

  for (const button of document.querySelectorAll('[data-lang]')) {
    button.addEventListener('click', () => {
      const language = button.getAttribute('data-lang');
      try {
        localStorage.setItem(STORAGE_KEY, language);
      } catch {
        /* el cambio dura hasta recargar */
      }
      apply(language);
    });
  }

  apply(detect());
})();
