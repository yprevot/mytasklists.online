import { expect, type Page } from '@playwright/test';

/** Inyecta una sesion ya iniciada para no repetir el login en cada caso */
export async function useSession(
  page: Page,
  tokens: { accessToken: string; refreshToken: string },
  storagePrefix = 'lc',
): Promise<void> {
  await page.addInitScript(
    ([prefix, access, refresh]) => {
      window.localStorage.setItem(`${prefix}.accessToken`, access);
      window.localStorage.setItem(`${prefix}.refreshToken`, refresh);
    },
    [storagePrefix, tokens.accessToken, tokens.refreshToken] as const,
  );
}

/** Login por la interfaz de la aplicacion web */
export async function loginThroughUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/app/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('lists-page')).toBeVisible();
}

/** Espera a que el indicador "En vivo" confirme la conexion WebSocket */
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
