import { expect, test } from '@playwright/test';

test.describe('Dashboard · idiomas', () => {
  test('CP-DASH-015 · el panel cambia de idioma y la eleccion se comparte con la app web', async ({ page }) => {
    await page.goto('/dashboard/login');
    await expect(page.getByTestId('login-card').getByRole('heading')).toHaveText('Panel de administracion');

    await page.getByTestId('language-en').click();
    await expect(page.getByTestId('login-card').getByRole('heading')).toHaveText('Admin panel');
    await expect(page.getByTestId('login-submit')).toHaveText('Sign in');

    await page.reload();
    await expect(page.getByTestId('login-card').getByRole('heading')).toHaveText('Admin panel');

    // Mismo dominio y misma preferencia: la app web tambien se abre en ingles
    await page.goto('/app/login');
    await expect(page.getByTestId('login-card').getByRole('heading')).toHaveText('Sign in');
  });
});
