import type { Locale } from '@lista/contracts';
import { ERRORS_EN } from './errors.en';

export type { Locale };

/** Sin cabecera se responde en español, como antes de agregar el inglés */
export const DEFAULT_LOCALE: Locale = 'es';

export const isLocale = (value: unknown): value is Locale => value === 'es' || value === 'en';

/**
 * Primer idioma soportado de `Accept-Language`, respetando los pesos:
 * "en-US,en;q=0.9,es;q=0.8" → en. Los clientes mandan solo "es" o "en".
 */
export function localeFromHeader(header: string | string[] | undefined): Locale {
  const value = Array.isArray(header) ? header.join(',') : (header ?? '');
  const ranked = value
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().toLowerCase().split(';');
      const q = params.find((param) => param.trim().startsWith('q='));
      return { lang: tag.split('-')[0], weight: q ? Number(q.trim().slice(2)) || 0 : 1, index };
    })
    .filter((entry) => entry.lang && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  return ranked.map((entry) => entry.lang).find(isLocale) ?? DEFAULT_LOCALE;
}

/** Mensaje para el cliente en su idioma; el español es el texto original */
export const translateMessage = (message: string, locale: Locale): string =>
  locale === 'en' ? (ERRORS_EN[message] ?? message) : message;
