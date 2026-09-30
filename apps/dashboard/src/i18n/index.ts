import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { es } from './es';
import { en } from './en';

export const LANGUAGES = ['es', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Compartida con la app web y la landing: todos se sirven desde el mismo dominio */
const STORAGE_KEY = 'lc.lang';

const isLanguage = (value: unknown): value is Language => LANGUAGES.includes(value as Language);

/**
 * La eleccion guardada gana; si no hay, se usa el primer idioma del navegador que
 * soportamos. Un navegador en otro idioma (frances, aleman…) ve la app en ingles.
 */
export function detectLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    /* almacenamiento no disponible */
  }
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of preferred) {
    const base = tag?.toLowerCase().split('-')[0];
    if (isLanguage(base)) return base;
  }
  return 'en';
}

export function setLanguage(language: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    /* almacenamiento no disponible: el cambio dura hasta recargar */
  }
  void i18n.changeLanguage(language);
}

export const currentLanguage = (): Language => (isLanguage(i18n.language) ? i18n.language : 'es');

/** Formato de fechas y numeros de cada idioma */
export const LOCALE_TAGS: Record<Language, string> = { es: 'es-MX', en: 'en-US' };

i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language;
});

void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: detectLanguage(),
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
});

export default i18n;
