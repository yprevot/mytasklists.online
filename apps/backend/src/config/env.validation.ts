import { Logger } from '@nestjs/common';
import { DEV_DEFAULTS } from './configuration';
import { parseVersion } from '../common/version';

const MIN_SECRET_LENGTH = 32;

/**
 * Se ejecuta al cargar la configuracion. En produccion el backend se niega a
 * arrancar con secretos de desarrollo, datos de demostracion o CORS abierto:
 * es preferible un contenedor que no levanta a uno que deja entrar a cualquiera.
 */
export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  const value = (key: string): string => String(env[key] ?? '');

  // Un valor ilegible desactivaria el corte de versiones sin avisar
  const minVersion = value('MOBILE_MIN_VERSION');
  if (minVersion && !parseVersion(minVersion)) {
    throw new Error(`MOBILE_MIN_VERSION debe tener la forma x.y.z (recibido: "${minVersion}")`);
  }

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
    errors.push('POSTGRES_PASSWORD no puede quedar vacia ni con el valor de desarrollo');
  }
  if (!value('REDIS_PASSWORD')) errors.push('REDIS_PASSWORD es obligatoria en produccion');

  if (['1', 'true', 'yes', 'on'].includes(value('RUN_SEED').toLowerCase())) {
    errors.push('RUN_SEED debe estar desactivado: crearia cuentas con contrasenas publicas');
  }

  const origins = value('CORS_ORIGINS');
  if (origins.split(',').map((origin) => origin.trim()).includes('*')) {
    errors.push('CORS_ORIGINS no puede incluir "*"');
  }

  if (!value('PUBLIC_URL').startsWith('https://')) {
    warnings.push('PUBLIC_URL no usa https: Google y Apple rechazan callbacks sin TLS');
  }
  if (!value('SMTP_HOST')) {
    warnings.push('SMTP_HOST vacio: los correos de verificacion y recuperacion no se enviaran');
  }

  const logger = new Logger('Configuracion');
  warnings.forEach((warning) => logger.warn(warning));

  if (errors.length) {
    throw new Error(
      `Configuracion insegura para produccion:\n  - ${errors.join('\n  - ')}\n` +
        'Revisa el .env (ver .env.example) antes de desplegar.',
    );
  }
  return env;
}
