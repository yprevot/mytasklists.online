import { expect, test } from '@playwright/test';

test.describe('Landing · página pública de descargas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('CP-LAND-001 · el hero explica la propuesta y ofrece las dos descargas', async ({ page }) => {
    await expect(page).toHaveTitle(/ListaDeCompras/);
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
});
