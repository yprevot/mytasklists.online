import { expect, test } from '@playwright/test';
import { createList, registerUser, type TestUser } from '../../utils/api-helpers';
import { pendingItem, purchasedItem, useSession } from '../../utils/ui-helpers';

test.describe('Frontend web · lista estilo check', () => {
  let user: TestUser;
  let listId: string;

  test.beforeEach(async ({ page, request }) => {
    user = await registerUser(request, { fullName: 'Diego Fuentes' });
    listId = (await createList(request, user.accessToken, 'Super del sabado')).id;
    await useSession(page, user);
    await page.goto(`/app/lists/${listId}`);
    await expect(page.getByTestId('list-detail-page')).toBeVisible();
  });

  test('CP-WEB-013 · agregar un producto puntual a la lista', async ({ page }) => {
    await page.getByTestId('item-name-input').fill('Pilas AA');
    await page.getByTestId('add-item-button').click();

    const item = pendingItem(page, 'Pilas AA');
    await expect(item).toBeVisible();
    await expect(item).toHaveAttribute('data-recurring', 'false');
    await expect(item.getByTestId('item-recurrence-badge')).toHaveCount(0);
    await expect(page.getByTestId('list-counters')).toContainText('1 por comprar');
  });

  test('CP-WEB-014 · marcar como comprado lo baja tachado a la lista de abajo', async ({ page }) => {
    await page.getByTestId('item-name-input').fill('Cafe molido');
    await page.getByTestId('add-item-button').click();
    await expect(pendingItem(page, 'Cafe molido')).toBeVisible();

    await pendingItem(page, 'Cafe molido').getByTestId('item-checkbox').click();

    // Desaparece de arriba y aparece en la seccion de comprados
    await expect(pendingItem(page, 'Cafe molido')).toHaveCount(0);
    await expect(page.getByTestId('purchased-section')).toBeVisible();

    const comprado = purchasedItem(page, 'Cafe molido');
    await expect(comprado).toBeVisible();

    // Tachado: la interfaz aplica line-through al nombre
    const decoration = await comprado
      .getByTestId('purchased-name')
      .evaluate((node) => getComputedStyle(node).textDecorationLine);
    expect(decoration).toContain('line-through');
  });

  test('CP-WEB-015 · la "x" quita el producto de la lista de comprados', async ({ page }) => {
    await page.getByTestId('item-name-input').fill('Servilletas');
    await page.getByTestId('add-item-button').click();
    await pendingItem(page, 'Servilletas').getByTestId('item-checkbox').click();
    await expect(purchasedItem(page, 'Servilletas')).toBeVisible();

    await purchasedItem(page, 'Servilletas').getByTestId('purchased-close').click();

    await expect(purchasedItem(page, 'Servilletas')).toHaveCount(0);
    await expect(page.getByTestId('purchased-section')).toHaveCount(0);
    await expect(page.getByTestId('pending-empty')).toBeVisible();
  });

  test('CP-WEB-016 · destachar un producto lo regresa a pendientes', async ({ page }) => {
    await page.getByTestId('item-name-input').fill('Tortillas');
    await page.getByTestId('add-item-button').click();
    await pendingItem(page, 'Tortillas').getByTestId('item-checkbox').click();
    await expect(purchasedItem(page, 'Tortillas')).toBeVisible();

    await purchasedItem(page, 'Tortillas').getByTestId('purchased-checkbox').click();

    await expect(pendingItem(page, 'Tortillas')).toBeVisible();
    await expect(purchasedItem(page, 'Tortillas')).toHaveCount(0);
  });

  test('CP-WEB-017 · vaciar de golpe la lista de comprados', async ({ page }) => {
    for (const name of ['Arroz', 'Frijol', 'Azucar']) {
      await page.getByTestId('item-name-input').fill(name);
      await page.getByTestId('add-item-button').click();
      await expect(pendingItem(page, name)).toBeVisible();
      await pendingItem(page, name).getByTestId('item-checkbox').click();
      await expect(purchasedItem(page, name)).toBeVisible();
    }

    await page.getByTestId('clear-purchased').click();
    await expect(page.getByTestId('purchased-section')).toHaveCount(0);
  });

  test('CP-WEB-018 · eliminar un producto pendiente con el bote de basura', async ({ page }) => {
    await page.getByTestId('item-name-input').fill('Producto de mas');
    await page.getByTestId('add-item-button').click();
    await expect(pendingItem(page, 'Producto de mas')).toBeVisible();

    await pendingItem(page, 'Producto de mas').getByTestId('item-delete').click();
    await expect(pendingItem(page, 'Producto de mas')).toHaveCount(0);
  });

  test('CP-WEB-019 · se puede indicar cantidad y unidad', async ({ page }) => {
    await page.getByTestId('item-name-input').fill('Leche entera');
    await page.getByTestId('toggle-item-options').click();
    await page.getByTestId('item-quantity-input').fill('2');
    await page.getByTestId('item-unit-input').fill('l');
    await page.getByTestId('add-item-button').click();

    await expect(pendingItem(page, 'Leche entera').getByTestId('item-quantity')).toHaveText('2 l');
  });
});
