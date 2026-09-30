import { expect, test } from '@playwright/test';

test.describe('Landing · idiomas', () => {
  test.use({ locale: 'en-US' });

  test('CP-LAND-007 · con el navegador en ingles se muestra en ingles y se puede cambiar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toContainText('Your pantry, always up to date.');
    await expect(page.getByTestId('nav-download')).toHaveText('Download');

    await page.getByTestId('language-es').click();
    await expect(page.locator('h1')).toContainText('Tu despensa, siempre al dia.');
    await expect(page.getByTestId('nav-download')).toHaveText('Descargar');

    await page.reload();
    await expect(page.locator('h1')).toContainText('Tu despensa, siempre al dia.');
  });
});
