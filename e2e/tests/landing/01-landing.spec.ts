import { expect, test } from '@playwright/test';

test.describe('Landing · página pública de descargas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('CP-LAND-001 · el hero explica la propuesta y ofrece las dos descargas', async ({ page }) => {
    await expect(page).toHaveTitle(/MyTaskLists/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tu despensa');

    const ios = page.getByTestId('download-ios');
    const android = page.getByTestId('download-android');

    await expect(ios).toBeVisible();
    await expect(ios).toContainText('App Store');
    await expect(android).toBeVisible();
    await expect(android).toContainText('Google Play');

    await expect(ios).toHaveAttribute('href', /.+/);
    await expect(android).toHaveAttribute('href', /.+/);
  });

  test('CP-LAND-002 · la sección de descarga repite ambas tiendas', async ({ page }) => {
    await page.getByTestId('nav-download').click();
    await expect(page.locator('#descargar')).toBeInViewport();

    await expect(page.getByTestId('download-ios-cta')).toContainText('iPhone y iPad');
    await expect(page.getByTestId('download-android-cta')).toContainText('Android');
  });

  test('CP-LAND-003 · se puede saltar a la aplicación web', async ({ page }) => {
    const link = page.getByTestId('open-web-app');
    await expect(link).toHaveAttribute('href', '/app/');

    await link.click();
    await expect(page).toHaveURL(/\/app\//);
    await expect(page.getByTestId('login-card')).toBeVisible();
  });

  test('CP-LAND-004 · se explican la recurrencia, el tiempo real y los avisos', async ({ page }) => {
    const funciones = page.locator('#funciones');
    await expect(funciones).toContainText('Productos recurrentes');
    await expect(funciones).toContainText('Avisos por color');
    await expect(funciones).toContainText('Estilo check');
    await expect(funciones).toContainText('Listas compartidas');
    await expect(funciones).toContainText('Tiempo real');

    const comoFunciona = page.locator('#como-funciona');
    await expect(comoFunciona).toContainText('Pan de caja');
    await expect(comoFunciona).toContainText('14 días');
    await expect(comoFunciona.locator('.step')).toHaveCount(4);
  });

  test('CP-LAND-005 · la página se adapta al móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('download-ios')).toBeVisible();
    await expect(page.getByTestId('download-android')).toBeVisible();

    // El contenido no se desborda horizontalmente
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('CP-LAND-006 · el pie enlaza la app, el panel y la API', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: 'App web' })).toHaveAttribute('href', '/app/');
    await expect(footer.getByRole('link', { name: 'Panel' })).toHaveAttribute('href', '/dashboard/');
    await expect(footer.getByRole('link', { name: 'API' })).toHaveAttribute('href', '/api/docs');
  });

  test('CP-LAND-009 · la política de privacidad se publica en español y en inglés', async ({ page }) => {
    await page.getByTestId('footer-privacy').click();
    await expect(page).toHaveURL(/\/privacidad$/);
    const policy = page.getByTestId('privacy-policy');
    await expect(policy.getByRole('heading', { level: 1 })).toHaveText('Política de privacidad');
    await expect(policy.locator('#eliminar')).toContainText('Eliminar mi cuenta');
    await expect(policy).not.toContainText('__');

    await page.getByTestId('language-en').click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByTestId('privacy-policy').getByRole('heading', { level: 1 })).toHaveText('Privacy policy');
  });

  test('CP-LAND-010 · las condiciones del servicio se publican en español y en inglés', async ({ page }) => {
    await page.getByTestId('footer-terms').click();
    await expect(page).toHaveURL(/\/terminos$/);
    const terms = page.getByTestId('terms-of-service');
    await expect(terms.getByRole('heading', { level: 1 })).toHaveText('Condiciones del servicio');
    await expect(terms.locator('#quienes')).toContainText('MyTaskListsOnline');
    await expect(terms).not.toContainText('__');

    await page.getByTestId('language-en').click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByTestId('terms-of-service').getByRole('heading', { level: 1 })).toHaveText('Terms of service');
  });

  test('CP-LAND-008 · el formulario del boletín aparece solo si está disponible', async ({ page }) => {
    const status = await page.request.get('/api/newsletter');
    const { enabled } = (await status.json()) as { enabled: boolean };
    // La sección se muestra solo cuando la API la anuncia como disponible
    await expect(page.locator('#boletin')).toBeVisible({ visible: enabled });
  });
});
