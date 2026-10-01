import { expect, test } from '@playwright/test';

test.describe('Landing · idiomas', () => {
  test.use({ locale: 'en-US' });

  test('CP-LAND-007 · la URL inglesa sirve HTML traducido y permite cambiar', async ({ page }) => {
    await page.goto('/en/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toContainText('Shared shopping lists.');
    await expect(page.getByTestId('nav-download')).toHaveText('Download');

    await page.getByTestId('language-es').click();
    await expect(page.locator('h1')).toContainText('Listas de compras compartidas.');
    await expect(page.getByTestId('nav-download')).toHaveText('Descargar');

    await page.reload();
    await expect(page.locator('h1')).toContainText('Listas de compras compartidas.');
  });
});
