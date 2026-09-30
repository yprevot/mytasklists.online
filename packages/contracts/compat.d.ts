/**
 * Compatibilidad entre versiones. Las apps de las tiendas se actualizan cuando
 * cada persona quiere, asi que la API atiende a varias versiones a la vez.
 *
 * La app movil manda en cada peticion `X-App-Version` (la `version` de app.json)
 * y `X-App-Platform`. Si su version es menor que la minima, la API responde 426
 * con `AppUpdateRequiredError` y la app pide actualizar. La web y el panel no
 * mandan version: se despliegan junto con el backend.
 */
import type { DevicePlatform } from './models';

export type AppPlatform = DevicePlatform;

/** GET /api/app/compatibility */
export interface AppCompatibility {
  /** Version minima de la app movil que la API sigue atendiendo */
  minVersion: string;
  storeUrls: {
    ios: string | null;
    android: string | null;
  };
}

/** Forma comun de todas las respuestas de error */
export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path?: string;
  timestamp: string;
  /** Codigo estable para que el cliente reaccione sin depender del texto */
  code?: string;
  details?: Record<string, unknown>;
}

export interface AppUpdateRequiredError extends ApiErrorBody {
  statusCode: 426;
  code: 'APP_UPDATE_REQUIRED';
  details: {
    minVersion: string;
    storeUrl: string | null;
  };
}
