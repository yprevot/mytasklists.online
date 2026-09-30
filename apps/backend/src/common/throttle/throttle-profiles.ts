import { ExecutionContext } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import configuration from '../../config/configuration';

// Los decoradores se evaluan al importar el modulo, asi que los limites se
// resuelven en cada peticion leyendo la configuracion ya cargada.
const config = () => configuration().rateLimit;

/** Login, registro, verificacion de 2FA y tokens sociales */
export const AuthThrottle = () =>
  Throttle({
    default: {
      limit: (_: ExecutionContext) => config().authLimit,
      ttl: (_: ExecutionContext) => config().authTtlMs,
    },
  });

/** Acciones que envian correo o validan tokens de un solo uso */
export const SensitiveThrottle = () =>
  Throttle({
    default: {
      limit: (_: ExecutionContext) => config().sensitiveLimit,
      ttl: (_: ExecutionContext) => config().sensitiveTtlMs,
    },
  });
