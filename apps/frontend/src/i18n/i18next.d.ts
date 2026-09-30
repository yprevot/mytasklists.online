import 'i18next';
import type { es } from './es';

// Claves de t() comprobadas contra el catálogo en español
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof es };
  }
}
