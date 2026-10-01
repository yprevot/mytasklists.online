import { expect, type Page } from '@playwright/test';
import { BASE_URL } from './api-helpers';

/** Cookie httpOnly en la que cada SPA guarda su refresh token */
const REFRESH_COOKIE = { lc: 'lc_rt', 'lc.dash': 'lc_dash_rt' } as const;

/**
 * Inyecta una sesión ya iniciada para no repetir el login en cada caso.
 * Las SPA guardan el refresh token en una cookie httpOnly (nunca en
 * localStorage): basta con ponerla en el contexto y la app recupera la sesión
 * con /auth/refresh al cargar.
 */
export async function useSession(
  page: Page,
  tokens: { accessToken: string; refreshToken: string },
  storagePrefix: keyof typeof REFRESH_COOKIE = 'lc',
): Promise<void> {
  const { hostname } = new URL(BASE_URL);
  await page.context().addCookies([
    {
      name: REFRESH_COOKIE[storagePrefix],
      value: tokens.refreshToken,
      domain: hostname,
      path: '/api/auth',
      httpOnly: true,
      secure: BASE_URL.startsWith('https://'),
      sameSite: 'Strict',
    },
  ]);
}

/** Login por la interfaz de la aplicación web */
export async function loginThroughUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/app/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('lists-page')).toBeVisible();
}

/** Espera a que el indicador "En vivo" confirme la conexión WebSocket */
export async function waitForRealtime(page: Page): Promise<void> {
  await expect(page.getByTestId('connection-status')).toHaveAttribute(
    'data-connected',
    'true',
    { timeout: 20_000 },
  );
}

/** Localiza la fila de un producto pendiente por su nombre */
export const pendingItem = (page: Page, name: string) =>
  page.locator(`[data-testid="pending-item"][data-item-name="${name}"]`);

/** Localiza la fila de un producto ya comprado por su nombre */
export const purchasedItem = (page: Page, name: string) =>
  page.locator(`[data-testid="purchased-item"][data-item-name="${name}"]`);
