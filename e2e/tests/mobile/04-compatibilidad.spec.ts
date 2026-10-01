import { expect, test } from '@playwright/test';

test.describe('App móvil · compatibilidad con la API', () => {
  test('CP-MOV-016 · la app se identifica con su versión en cada petición', async ({ page }) => {
    const compatibility = page.waitForRequest((req) => req.url().includes('/api/app/compatibility'));
    await page.goto('/');

    const headers = (await compatibility).headers();
    expect(headers['x-app-version']).toMatch(/^\d+\.\d+\.\d+$/);
    expect(headers['x-app-platform']).toBe('web');
    await expect(page.getByTestId('login-screen')).toBeVisible();
  });

  test('CP-MOV-017 · una versión que ya no es compatible pide actualizar la app', async ({ page }) => {
    // Simula que el backend ya exige una versión posterior a la instalada
    await page.route('**/api/app/compatibility', (route) =>
      route.fulfill({
        status: 426,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 426,
          error: 'UpgradeRequired',
          message: 'Esta versión de la app ya no es compatible. Actualízala para seguir usándola.',
          code: 'APP_UPDATE_REQUIRED',
          details: { minVersion: '9.0.0', storeUrl: 'https://apps.apple.com/app/id000000000' },
          timestamp: new Date().toISOString(),
        }),
      }),
    );
    await page.goto('/');

    await expect(page.getByTestId('update-required-screen')).toBeVisible();
    await expect(page.getByTestId('update-required-versions')).toContainText('9.0.0');
    await expect(page.getByTestId('open-store')).toBeVisible();
    await expect(page.getByTestId('login-screen')).toHaveCount(0);
  });
});
