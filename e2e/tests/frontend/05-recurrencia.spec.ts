import { expect, test } from '@playwright/test';
import {
  advanceClock,
  createItem,
  createList,
  registerUser,
  type TestUser,
} from '../../utils/api-helpers';
import { pendingItem, purchasedItem, useSession } from '../../utils/ui-helpers';

test.describe('Frontend web · productos recurrentes', () => {
  let user: TestUser;
  let listId: string;

  test.beforeEach(async ({ page, request }) => {
    user = await registerUser(request, { fullName: 'Ana Recurrente' });
    listId = (await createList(request, user.accessToken, 'Despensa quincenal')).id;
    await useSession(page, user);
  });

  test('CP-WEB-020 · agregar "Pan de caja" con recurrencia de 14 dias', async ({ page }) => {
    await page.goto(`/app/lists/${listId}`);

    await page.getByTestId('item-name-input').fill('Pan de caja');
    await page.getByTestId('toggle-item-options').click();
    await page.getByTestId('item-recurring-switch').check();
    await expect(page.getByTestId('recurrence-options')).toBeVisible();
    await page.getByTestId('recurrence-preset-14').click();
    await page.getByTestId('add-item-button').click();

    const item = pendingItem(page, 'Pan de caja');
    await expect(item).toBeVisible();
    await expect(item).toHaveAttribute('data-recurring', 'true');
    await expect(item).toHaveAttribute('data-overdue', 'false');
    await expect(item.getByTestId('item-recurrence-badge')).toContainText('cada 14 d');
    await expect(item.getByTestId('item-due-hint')).toContainText('vence en 14 d');
  });

  test('CP-WEB-021 · al comprarlo se anuncia cuando volvera a la lista', async ({ page, request }) => {
    await createItem(request, user.accessToken, listId, {
      name: 'Pan de caja',
      isRecurring: true,
      recurrenceDays: 14,
    });
    await page.goto(`/app/lists/${listId}`);

    await pendingItem(page, 'Pan de caja').getByTestId('item-checkbox').click();

    const comprado = purchasedItem(page, 'Pan de caja');
    await expect(comprado).toBeVisible();
    await expect(comprado.getByTestId('purchased-return-badge')).toContainText('vuelve en 14 d');
    await expect(page.getByTestId('toast-body')).toContainText('14 dias');
  });

  test('CP-WEB-022 · pasados los 14 dias el producto reaparece en pendientes', async ({
    page,
    request,
  }) => {
    const item = await createItem(request, user.accessToken, listId, {
      name: 'Pan de caja',
      isRecurring: true,
      recurrenceDays: 14,
    });
    await page.goto(`/app/lists/${listId}`);

    // Se compra el viernes (5 dias despues de agregarlo)
    await advanceClock(request, user.accessToken, item.id, 5);
    await pendingItem(page, 'Pan de caja').getByTestId('item-checkbox').click();
    await expect(purchasedItem(page, 'Pan de caja')).toBeVisible();

    // El reloj avanza 14 dias desde la compra usando el menu de la interfaz
    await purchasedItem(page, 'Pan de caja').scrollIntoViewIfNeeded();
    await advanceClock(request, user.accessToken, item.id, 14);
    await page.reload();

    const vuelto = pendingItem(page, 'Pan de caja');
    await expect(vuelto).toBeVisible();
    await expect(vuelto.getByTestId('item-cycle')).toContainText('ciclo 2');
    await expect(page.getByTestId('purchased-section')).toHaveCount(0);
  });

  test('CP-WEB-023 · un recurrente vencido se pinta de otro color', async ({ page, request }) => {
    const item = await createItem(request, user.accessToken, listId, {
      name: 'Leche entera',
      isRecurring: true,
      recurrenceDays: 7,
    });

    await page.goto(`/app/lists/${listId}`);
    const fila = pendingItem(page, 'Leche entera');
    await expect(fila).toHaveAttribute('data-overdue', 'false');
    const colorInicial = await fila.evaluate((node) => getComputedStyle(node).borderLeftColor);

    // Pasa el plazo sin comprarlo
    await advanceClock(request, user.accessToken, item.id, 9);
    await page.reload();

    const vencida = pendingItem(page, 'Leche entera');
    await expect(vencida).toHaveAttribute('data-overdue', 'true');
    await expect(vencida.getByTestId('item-overdue-badge')).toContainText('vencido');
    await expect(page.getByTestId('list-overdue-summary')).toContainText('1 vencido');

    // El color del indicador cambia respecto al estado normal
    const colorVencido = await vencida.evaluate((node) => getComputedStyle(node).borderLeftColor);
    expect(colorVencido).not.toBe(colorInicial);

    // Y sigue estando en la lista, no desaparece
    await expect(vencida).toBeVisible();
  });

  test('CP-WEB-024 · comprar un vencido reinicia su ciclo', async ({ page, request }) => {
    const item = await createItem(request, user.accessToken, listId, {
      name: 'Huevo',
      isRecurring: true,
      recurrenceDays: 7,
    });
    await advanceClock(request, user.accessToken, item.id, 10);

    await page.goto(`/app/lists/${listId}`);
    await expect(pendingItem(page, 'Huevo')).toHaveAttribute('data-overdue', 'true');

    await pendingItem(page, 'Huevo').getByTestId('item-checkbox').click();

    await expect(purchasedItem(page, 'Huevo')).toBeVisible();
    await expect(page.getByTestId('list-overdue-summary')).toHaveCount(0);
    await expect(purchasedItem(page, 'Huevo').getByTestId('purchased-return-badge')).toContainText(
      'vuelve en 7 d',
    );
  });

  test('CP-WEB-025 · el menu de recurrencia permite simular el paso del tiempo', async ({
    page,
    request,
  }) => {
    await createItem(request, user.accessToken, listId, {
      name: 'Cafe molido',
      isRecurring: true,
      recurrenceDays: 14,
    });
    await page.goto(`/app/lists/${listId}`);

    await pendingItem(page, 'Cafe molido').getByTestId('item-clock-menu').click();
    await page.getByTestId('advance-14').click();

    await expect(
      page.getByTestId('toast').filter({ hasText: 'Reloj adelantado' }),
    ).toBeVisible();
    await expect(pendingItem(page, 'Cafe molido')).toHaveAttribute('data-overdue', 'true');
  });
});
