import 'i18next';
import type { es } from './es';

// Claves de t() comprobadas contra el catalogo en espanol
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof es };
  }
}
