import { expect, test } from '@playwright/test';

test.describe('App móvil · idiomas', () => {
  test.use({ locale: 'en-US' });

  test('CP-MOV-018 · con el teléfono en inglés la app se abre en inglés y se puede cambiar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('login-screen')).toBeVisible();
    await expect(page.getByTestId('login-screen')).toContainText('Your shared lists, always in sync.');

    await page.getByTestId('language-es').click();
    await expect(page.getByTestId('login-screen')).toContainText('Tus listas compartidas, siempre sincronizadas.');

    await page.reload();
    await expect(page.getByTestId('login-screen')).toContainText('Tus listas compartidas, siempre sincronizadas.');
  });
});
