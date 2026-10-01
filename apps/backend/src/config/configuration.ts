/**
 * Configuración central de la aplicación.
 * Todo se lee de variables de entorno para que la imagen Docker sea inmutable.
 */
export interface RateLimitConfig {
  enabled: boolean;
  /** Peticiones por IP y ventana en toda la API */
  globalLimit: number;
  globalTtlMs: number;
  /** Login, registro y verificación de 2FA: peticiones por IP y ventana */
  authLimit: number;
  authTtlMs: number;
  /** Recuperar contraseña y reenviar verificación: peticiones por IP y ventana */
  sensitiveLimit: number;
  sensitiveTtlMs: number;
  /** Intentos fallidos de login por correo antes de bloquearlo temporalmente */
  loginMaxFailures: number;
  loginLockMs: number;
}

/** Compatibilidad con las apps de las tiendas (ver docs/COMPATIBILIDAD.md) */
/** Boletín en Listmonk: la landing ofrece el alta solo si está configurado */
export interface NewsletterConfig {
  listmonkUrl: string;
  listUuid: string;
  enabled: boolean;
}

export interface MobileConfig {
  /** Las apps por debajo de esta versión reciben 426 y deben actualizarse */
  minVersion: string;
  rolloutPhase: 'bridge' | 'enforced';
  releaseReadyVersion: string | null;
  downloadUrl: string;
  webUrl: string;
  storeUrls: { ios: string | null; android: string | null };
}

export interface AppConfig {
  env: string;
  isProduction: boolean;
  port: number;
  apiPrefix: string;
  publicUrl: string;
  corsOrigins: string[];
  /** Saltos de proxy de confianza para calcular la IP real (nginx = 1) */
  trustProxy: boolean | number;
  bodyLimit: number;
  swaggerEnabled: boolean;
  /** Las cuentas de administración necesitan 2FA activa para usar /admin */
  adminRequireMfa: boolean;
  allowTimeTravel: boolean;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    runMigrations: boolean;
    runSeed: boolean;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    ttl: number;
  };
  jwt: {
    accessSecret: string;
    accessTtl: string;
    refreshSecret: string;
    refreshTtl: string;
  };
  auth: {
    /** Marca Secure en la cookie del refresh token (siempre en https) */
    cookieSecure: boolean;
    emailVerificationTtlSeconds: number;
    passwordResetTtlSeconds: number;
  };
  /** Clave para cifrar secretos en reposo (p. ej. el secreto TOTP de 2FA) */
  encryptionKey: string;
  mail: {
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
    from: string;
  };
  rateLimit: RateLimitConfig;
  google: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
    enabled: boolean;
    /** client_id aceptados como `aud` del id_token (web + iOS + Android) */
    allowedAudiences: string[];
  };
  apple: {
    clientId: string;
    teamId: string;
    keyId: string;
    privateKey: string;
    callbackUrl: string;
    /** Bundle id de la app de iOS: client_id de los códigos que emite el inicio nativo */
    bundleId: string;
    enabled: boolean;
    /** Service ID (web) + bundle id de la app nativa */
    allowedAudiences: string[];
  };
  recurrence: { cron: string };
  push: { expoAccessToken?: string };
  mobile: MobileConfig;
  newsletter: NewsletterConfig;
}

export const DEV_DEFAULTS = {
  jwtAccessSecret: 'dev_access_secret_change_me',
  jwtRefreshSecret: 'dev_refresh_secret_change_me',
  postgresPassword: 'lista_dev_password',
} as const;

const bool = (value: string | undefined, fallback = false): boolean =>
  value === undefined || value === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());

const int = (value: string | undefined, fallback: number): number => {
  const parsed = parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const list = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const parseTrustProxy = (value: string | undefined): boolean | number => {
  if (value === undefined || value === '') return 1;
  if (['true', 'false'].includes(value.toLowerCase())) return value.toLowerCase() === 'true';
  return int(value, 1);
};

export default (): AppConfig => {
  const env = process.env.NODE_ENV ?? 'development';
  const isProduction = env === 'production';
  const publicUrl = process.env.PUBLIC_URL ?? 'http://localhost:8080';

  // En desarrollo y pruebas los límites son holgados para no frenar la suite e2e;
  // en producción son estrictos. Cualquiera se puede fijar por variable de entorno.
  const rl = (name: string, prod: number, dev: number) =>
    int(process.env[name], isProduction ? prod : dev);

  const googleClientId = process.env.GOOGLE_CLIENT_ID ?? '';
  const appleClientId = process.env.APPLE_CLIENT_ID ?? '';

  return {
    env,
    isProduction,
    port: int(process.env.PORT, 3000),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    publicUrl,
    corsOrigins: list(process.env.CORS_ORIGINS ?? 'http://localhost:8080'),
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
    bodyLimit: int(process.env.BODY_LIMIT_BYTES, 1024 * 1024),
    swaggerEnabled: bool(process.env.SWAGGER_ENABLED, !isProduction),
    allowTimeTravel: bool(process.env.ALLOW_TIME_TRAVEL, !isProduction),
    adminRequireMfa: bool(process.env.ADMIN_REQUIRE_MFA, isProduction),
    database: {
      host: process.env.POSTGRES_HOST ?? 'postgres',
      port: int(process.env.POSTGRES_PORT, 5432),
      username: process.env.POSTGRES_USER ?? 'lista',
      password: process.env.POSTGRES_PASSWORD ?? DEV_DEFAULTS.postgresPassword,
      database: process.env.POSTGRES_DB ?? 'mytasklists',
      runMigrations: bool(process.env.RUN_MIGRATIONS, true),
      runSeed: bool(process.env.RUN_SEED, false),
    },
    redis: {
      host: process.env.REDIS_HOST ?? 'redis',
      port: int(process.env.REDIS_PORT, 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      ttl: int(process.env.REDIS_TTL, 60),
    },
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? DEV_DEFAULTS.jwtAccessSecret,
      accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? DEV_DEFAULTS.jwtRefreshSecret,
      refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
    },
    auth: {
      cookieSecure: bool(process.env.COOKIE_SECURE, publicUrl.startsWith('https://')),
      emailVerificationTtlSeconds: int(process.env.EMAIL_VERIFICATION_TTL_SECONDS, 24 * 3600),
      passwordResetTtlSeconds: int(process.env.PASSWORD_RESET_TTL_SECONDS, 3600),
    },
    encryptionKey:
      process.env.APP_ENCRYPTION_KEY ||
      `derived:${process.env.JWT_ACCESS_SECRET ?? DEV_DEFAULTS.jwtAccessSecret}`,
    mail: {
      enabled: Boolean(process.env.SMTP_HOST),
      host: process.env.SMTP_HOST ?? '',
      port: int(process.env.SMTP_PORT, 587),
      secure: bool(process.env.SMTP_SECURE, false),
      user: process.env.SMTP_USER || undefined,
      password: process.env.SMTP_PASSWORD || undefined,
      from: process.env.MAIL_FROM ?? 'MyTaskLists <no-responder@localhost>',
    },
    rateLimit: {
      enabled: bool(process.env.RATE_LIMIT_ENABLED, true),
      globalLimit: rl('RATE_LIMIT_GLOBAL', 300, 5000),
      globalTtlMs: int(process.env.RATE_LIMIT_GLOBAL_TTL_MS, 60_000),
      authLimit: rl('RATE_LIMIT_AUTH', 10, 1000),
      authTtlMs: int(process.env.RATE_LIMIT_AUTH_TTL_MS, 60_000),
      sensitiveLimit: rl('RATE_LIMIT_SENSITIVE', 5, 1000),
      sensitiveTtlMs: int(process.env.RATE_LIMIT_SENSITIVE_TTL_MS, 15 * 60_000),
      loginMaxFailures: int(process.env.LOGIN_MAX_FAILURES, 10),
      loginLockMs: int(process.env.LOGIN_LOCK_MS, 15 * 60_000),
    },
    google: {
      clientId: googleClientId,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackUrl:
        process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:8080/api/auth/google/callback',
      enabled: Boolean(googleClientId && process.env.GOOGLE_CLIENT_SECRET),
      allowedAudiences: [googleClientId, ...list(process.env.GOOGLE_ALLOWED_AUDIENCES)].filter(Boolean),
    },
    apple: {
      clientId: appleClientId,
      teamId: process.env.APPLE_TEAM_ID ?? '',
      keyId: process.env.APPLE_KEY_ID ?? '',
      privateKey: (process.env.APPLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
      callbackUrl: process.env.APPLE_CALLBACK_URL ?? 'http://localhost:8080/api/auth/apple/callback',
      bundleId: process.env.APPLE_BUNDLE_ID ?? 'online.mytasklists.app',
      enabled: Boolean(appleClientId && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID),
      allowedAudiences: [appleClientId, ...list(process.env.APPLE_ALLOWED_AUDIENCES)].filter(Boolean),
    },
    recurrence: { cron: process.env.RECURRENCE_CRON ?? '0 */5 * * * *' },
    push: { expoAccessToken: process.env.EXPO_ACCESS_TOKEN || undefined },
    mobile: {
      minVersion: process.env.MOBILE_MIN_VERSION || '1.0.0',
      rolloutPhase: (process.env.MOBILE_ROLLOUT_PHASE || 'bridge') as 'bridge' | 'enforced',
      releaseReadyVersion: process.env.MOBILE_RELEASE_READY_VERSION || null,
      downloadUrl: (process.env.PUBLIC_URL || 'http://localhost:8080').replace(/\/$/,'') + '/descargar/',
      webUrl: (process.env.PUBLIC_URL || 'http://localhost:8080').replace(/\/$/,'') + '/app/',
      storeUrls: {
        ios: process.env.MOBILE_STORE_URL_IOS || null,
        android: process.env.MOBILE_STORE_URL_ANDROID || null,
      },
    },
    newsletter: {
      listmonkUrl: (process.env.LISTMONK_URL ?? '').replace(/\/+$/, ''),
      listUuid: process.env.LISTMONK_LIST_UUID ?? '',
      enabled: Boolean(process.env.LISTMONK_URL && process.env.LISTMONK_LIST_UUID),
    },
  };
};
