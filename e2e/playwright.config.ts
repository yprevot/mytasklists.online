import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const MOBILE_URL = process.env.E2E_MOBILE_URL ?? 'http://localhost:19006';

/**
 * Configuracion de las pruebas end-to-end.
 *
 * Un proyecto por servicio:
 *   backend-api → pruebas de la API (sin interfaz, sin video)
 *   frontend    → aplicacion web de usuarios      (video por caso)
 *   dashboard   → panel de administracion         (video por caso)
 *   landing     → pagina publica de descargas     (video por caso)
 *   mobile-app  → app React Native servida en web (video por caso)
 *
 * Los videos se reorganizan al terminar en `evidence/<servicio>/<caso>.webm`
 * (ver utils/global-teardown.ts).
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  globalSetup: './utils/global-setup.ts',

  reporter: [
    ['list'],
    // Guarda un video con nombre legible por cada caso con interfaz
    ['./utils/evidence-reporter.ts'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/resultados.json' }],
  ],

  use: {
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    ignoreHTTPSErrors: true,
  },

  projects: [
    // ── API (sin interfaz: no genera video) ──────────────────────────
    {
      name: 'backend-api',
      testDir: './tests/backend',
      use: {
        baseURL: process.env.E2E_API_URL ?? `${BASE_URL}/api`,
        video: 'off',
      },
    },

    // ── Aplicacion web de usuarios ───────────────────────────────────
    {
      name: 'frontend',
      testDir: './tests/frontend',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: BASE_URL,
        viewport: { width: 1280, height: 800 },
        video: { mode: 'on', size: { width: 1280, height: 800 } },
      },
    },

    // ── Panel de administracion ──────────────────────────────────────
    {
      name: 'dashboard',
      testDir: './tests/dashboard',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: BASE_URL,
        viewport: { width: 1440, height: 900 },
        video: { mode: 'on', size: { width: 1440, height: 900 } },
      },
    },

    // ── Landing publica ──────────────────────────────────────────────
    {
      name: 'landing',
      testDir: './tests/landing',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: BASE_URL,
        viewport: { width: 1280, height: 900 },
        video: { mode: 'on', size: { width: 1280, height: 900 } },
      },
    },

    // ── App movil (React Native Web) ─────────────────────────────────
    {
      name: 'mobile-app',
      testDir: './tests/mobile',
      use: {
        ...devices['Pixel 7'],
        baseURL: MOBILE_URL,
        video: { mode: 'on', size: { width: 412, height: 915 } },
      },
    },
  ],

  // Servidor estatico del bundle web de la app movil.
  // El resto de servicios corren en Docker (`docker compose up -d`).
  webServer: process.env.E2E_SKIP_MOBILE_SERVER
    ? undefined
    : {
        command: 'node utils/mobile-web-server.mjs',
        url: MOBILE_URL,
        reuseExistingServer: true,
        timeout: 60_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
