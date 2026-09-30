import { expect, test } from '@playwright/test';
import { registerUser, type TestUser } from '../../utils/api-helpers';
import { useSession } from '../../utils/ui-helpers';

test.describe('Frontend web · gestion de listas', () => {
  let user: TestUser;

  test.beforeEach(async ({ page, request }) => {
    user = await registerUser(request, { fullName: 'Lucia Herrera' });
    await useSession(page, user);
  });

  test('CP-WEB-009 · crear una lista nueva desde cero', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByTestId('lists-empty')).toBeVisible();

    await page.getByTestId('new-list-button').click();
    await page.getByTestId('new-list-name').fill('Despensa quincenal');
    await page.getByTestId('new-list-submit').click();

    await expect(page.getByTestId('toast')).toContainText('Despensa quincenal');
    const card = page.locator('[data-testid="list-card-link"][data-list-name="Despensa quincenal"]');
    await expect(card).toBeVisible();
    await expect(card.getByTestId('list-pending-count')).toContainText('0 por comprar');
  });

  test('CP-WEB-010 · una persona puede tener varias listas a la vez', async ({ page }) => {
    await page.goto('/app/');

    for (const name of ['Super', 'Ferreteria', 'Farmacia']) {
      await page.getByTestId('new-list-button').click();
      await page.getByTestId('new-list-name').fill(name);
      await page.getByTestId('new-list-submit').click();
      await expect(
        page.locator(`[data-testid="list-card-link"][data-list-name="${name}"]`),
      ).toBeVisible();
    }

    await expect(page.getByTestId('list-card-link')).toHaveCount(3);
  });

  test('CP-WEB-011 · abrir una lista y volver al listado', async ({ page }) => {
    await page.goto('/app/');
    await page.getByTestId('new-list-button').click();
    await page.getByTestId('new-list-name').fill('Lista navegable');
    await page.getByTestId('new-list-submit').click();

    await page.locator('[data-testid="list-card-link"][data-list-name="Lista navegable"]').click();
    await expect(page.getByTestId('list-detail-page')).toBeVisible();
    await expect(page.getByTestId('list-title')).toHaveText('Lista navegable');

    await page.getByTestId('back-to-lists').click();
    await expect(page.getByTestId('lists-page')).toBeVisible();
  });

  test('CP-WEB-012 · eliminar una lista completa', async ({ page }) => {
    await page.goto('/app/');
    await page.getByTestId('new-list-button').click();
    await page.getByTestId('new-list-name').fill('Lista desechable');
    await page.getByTestId('new-list-submit').click();
    await page.locator('[data-testid="list-card-link"][data-list-name="Lista desechable"]').click();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('delete-list-button').click();

    await expect(page.getByTestId('lists-page')).toBeVisible();
    await expect(
      page.locator('[data-testid="list-card-link"][data-list-name="Lista desechable"]'),
    ).toHaveCount(0);
  });
});
