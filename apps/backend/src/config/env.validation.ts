import { Logger } from '@nestjs/common';
import { DEV_DEFAULTS } from './configuration';
import { REGISTRATION_MIN_VERSION } from '../common/mobile-rollout';
import { compareVersions, parseVersion } from '../common/version';

const MIN_SECRET_LENGTH = 32;

/**
 * Se ejecuta al cargar la configuración. En producción el backend se niega a
 * arrancar con secretos de desarrollo, datos de demostración o CORS abierto:
 * es preferible un contenedor que no levanta a uno que deja entrar a cualquiera.
 */
export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  const value = (key: string): string => String(env[key] ?? '');

  // Un valor ilegible desactivaría el corte de versiones sin avisar
  const minVersion = value('MOBILE_MIN_VERSION');
  if (minVersion && !parseVersion(minVersion)) {
    throw new Error(`MOBILE_MIN_VERSION debe tener la forma x.y.z (recibido: "${minVersion}")`);
  }

  const phase = value('MOBILE_ROLLOUT_PHASE') || 'bridge';
  const minimum = parseVersion(minVersion || '1.0.0')!;
  const registrationMinimum = parseVersion(REGISTRATION_MIN_VERSION)!;
  const readyText = value('MOBILE_RELEASE_READY_VERSION');
  const ready = parseVersion(readyText);
  if (!['bridge', 'enforced'].includes(phase)) throw new Error('MOBILE_ROLLOUT_PHASE debe ser bridge o enforced');
  if (readyText && !ready) throw new Error('MOBILE_RELEASE_READY_VERSION debe tener la forma x.y.z');
  if (phase === 'bridge' && compareVersions(minimum, registrationMinimum) >= 0)
    throw new Error('En bridge conserva MOBILE_MIN_VERSION por debajo de 2.0.0; el corte requiere enforced');
  if (phase === 'enforced' && (compareVersions(minimum, registrationMinimum) < 0 || !ready || compareVersions(ready, minimum) < 0))
    throw new Error('El corte requiere MOBILE_MIN_VERSION >= 2.0.0 y MOBILE_RELEASE_READY_VERSION >= MOBILE_MIN_VERSION');

  if (value('NODE_ENV') !== 'production') return env;

  const errors: string[] = [];
  const warnings: string[] = [];

  const secret = (key: string, devDefault?: string) => {
    const current = value(key);
    if (!current) errors.push(`${key} es obligatoria`);
    else if (devDefault && current === devDefault) errors.push(`${key} conserva el valor de desarrollo`);
    else if (current.length < MIN_SECRET_LENGTH)
      errors.push(`${key} debe tener al menos ${MIN_SECRET_LENGTH} caracteres`);
  };

  secret('JWT_ACCESS_SECRET', DEV_DEFAULTS.jwtAccessSecret);
  secret('JWT_REFRESH_SECRET', DEV_DEFAULTS.jwtRefreshSecret);
  secret('APP_ENCRYPTION_KEY');
  if (value('JWT_ACCESS_SECRET') && value('JWT_ACCESS_SECRET') === value('JWT_REFRESH_SECRET')) {
    errors.push('JWT_ACCESS_SECRET y JWT_REFRESH_SECRET deben ser distintas');
  }

  const pgPassword = value('POSTGRES_PASSWORD');
  if (!pgPassword || pgPassword === DEV_DEFAULTS.postgresPassword) {
    errors.push('POSTGRES_PASSWORD no puede quedar vacía ni con el valor de desarrollo');
  }
  if (!value('REDIS_PASSWORD')) errors.push('REDIS_PASSWORD es obligatoria en producción');

  if (['1', 'true', 'yes', 'on'].includes(value('RUN_SEED').toLowerCase())) {
    errors.push('RUN_SEED debe estar desactivado: crearía cuentas con contraseñas públicas');
  }

  const origins = value('CORS_ORIGINS');
  if (origins.split(',').map((origin) => origin.trim()).includes('*')) {
    errors.push('CORS_ORIGINS no puede incluir "*"');
  }

  if (!value('PUBLIC_URL').startsWith('https://')) {
    warnings.push('PUBLIC_URL no usa https: Google y Apple rechazan callbacks sin TLS');
  }
  if (!value('SMTP_HOST')) {
    warnings.push('SMTP_HOST vacío: los correos de verificación y recuperación no se enviarán');
  }

  const logger = new Logger('Configuración');
  warnings.forEach((warning) => logger.warn(warning));

  if (errors.length) {
    throw new Error(
      `Configuración insegura para producción:\n  - ${errors.join('\n  - ')}\n` +
        'Revisa el .env (ver .env.example) antes de desplegar.',
    );
  }
  return env;
}
