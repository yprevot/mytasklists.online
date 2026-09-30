/**
 * Configuracion central de la aplicacion.
 * Todo se lee de variables de entorno para que la imagen Docker sea inmutable.
 */
export interface AppConfig {
  env: string;
  port: number;
  apiPrefix: string;
  publicUrl: string;
  corsOrigins: string[];
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
  google: { clientId: string; clientSecret: string; callbackUrl: string; enabled: boolean };
  apple: {
    clientId: string;
    teamId: string;
    keyId: string;
    privateKey: string;
    callbackUrl: string;
    enabled: boolean;
  };
  recurrence: { cron: string };
  push: { expoAccessToken?: string };
}

const bool = (value: string | undefined, fallback = false): boolean =>
  value === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  publicUrl: process.env.PUBLIC_URL ?? 'http://localhost:8080',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:8080')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  database: {
    host: process.env.POSTGRES_HOST ?? 'postgres',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    username: process.env.POSTGRES_USER ?? 'lista',
    password: process.env.POSTGRES_PASSWORD ?? 'lista_dev_password',
    database: process.env.POSTGRES_DB ?? 'listadecompras',
    runMigrations: bool(process.env.RUN_MIGRATIONS, true),
    runSeed: bool(process.env.RUN_SEED, false),
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'redis',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    ttl: parseInt(process.env.REDIS_TTL ?? '60', 10),
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret_change_me',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret_change_me',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:8080/api/auth/google/callback',
    enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  },
  apple: {
    clientId: process.env.APPLE_CLIENT_ID ?? '',
    teamId: process.env.APPLE_TEAM_ID ?? '',
    keyId: process.env.APPLE_KEY_ID ?? '',
    privateKey: (process.env.APPLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    callbackUrl: process.env.APPLE_CALLBACK_URL ?? 'http://localhost:8080/api/auth/apple/callback',
    enabled: Boolean(
      process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID,
    ),
  },
  recurrence: { cron: process.env.RECURRENCE_CRON ?? '0 */5 * * * *' },
  push: { expoAccessToken: process.env.EXPO_ACCESS_TOKEN || undefined },
});
