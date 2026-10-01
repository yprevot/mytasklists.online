import { ExecutionContext } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import configuration from '../../config/configuration';

// Los decoradores se evalúan al importar el módulo, así que los límites se
// resuelven en cada petición leyendo la configuración ya cargada.
const config = () => configuration().rateLimit;

/** Login, registro, verificación de 2FA y tokens sociales */
export const AuthThrottle = () =>
  Throttle({
    default: {
      limit: (_: ExecutionContext) => config().authLimit,
      ttl: (_: ExecutionContext) => config().authTtlMs,
    },
  });

/** Acciones que envían correo o validan tokens de un solo uso */
export const SensitiveThrottle = () =>
  Throttle({
    default: {
      limit: (_: ExecutionContext) => config().sensitiveLimit,
      ttl: (_: ExecutionContext) => config().sensitiveTtlMs,
    },
  });
