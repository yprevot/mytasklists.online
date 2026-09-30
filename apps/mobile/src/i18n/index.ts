import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { es } from './es';
import { en } from './en';

export const LANGUAGES = ['es', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = 'lc.mobile.lang';

const isLanguage = (value: unknown): value is Language => LANGUAGES.includes(value as Language);

/** Primer idioma del telefono que soportamos; en otro idioma la app se ve en ingles */
function deviceLanguage(): Language {
  for (const locale of getLocales()) {
    if (isLanguage(locale.languageCode)) return locale.languageCode;
  }
  return 'en';
}

export const currentLanguage = (): Language => (isLanguage(i18n.language) ? i18n.language : 'es');

export function setLanguage(language: Language): void {
  void i18n.changeLanguage(language);
  AsyncStorage.setItem(STORAGE_KEY, language).catch(() => undefined);
}

void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: deviceLanguage(),
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
});

// La eleccion guardada gana sobre el idioma del telefono
AsyncStorage.getItem(STORAGE_KEY)
  .then((stored) => {
    if (isLanguage(stored) && stored !== i18n.language) void i18n.changeLanguage(stored);
  })
  .catch(() => undefined);

export default i18n;
