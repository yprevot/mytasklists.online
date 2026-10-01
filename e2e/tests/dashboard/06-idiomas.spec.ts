import { expect, test } from '@playwright/test';

test.describe('Dashboard · idiomas', () => {
  test('CP-DASH-015 · el panel cambia de idioma y la elección se comparte con la app web', async ({ page }) => {
    await page.goto('/dashboard/login');
    await expect(page.getByTestId('login-card').getByRole('heading')).toHaveText('Panel de administración');

    await page.getByTestId('language-en').click();
    await expect(page.getByTestId('login-card').getByRole('heading')).toHaveText('Admin panel');
    await expect(page.getByTestId('login-submit')).toHaveText('Sign in');

    await page.reload();
    await expect(page.getByTestId('login-card').getByRole('heading')).toHaveText('Admin panel');

    // Mismo dominio y misma preferencia: la app web también se abre en inglés
    await page.goto('/app/login');
    await expect(page.getByTestId('login-card').getByRole('heading')).toHaveText('Sign in');
  });
});
