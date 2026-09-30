import { expect, test, type Page } from '@playwright/test';
import {
  API_URL,
  advanceClock,
  auth,
  createItem,
  createList,
  registerUser,
  type TestUser,
} from '../../utils/api-helpers';

const loginInApp = async (page: Page, user: TestUser): Promise<void> => {
  await page.goto('/');
  await page.getByTestId('login-email').fill(user.email);
  await page.getByTestId('login-password').fill(user.password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('lists-screen')).toBeVisible({ timeout: 20_000 });
};

const openList = async (page: Page, name: string): Promise<void> => {
  await page.getByTestId('list-card').filter({ hasText: name }).click();
  await expect(page.getByTestId('list-detail-screen')).toBeVisible({ timeout: 20_000 });
};

test.describe('App movil · listas y recurrencia', () => {
  test('CP-MOV-007 · crear una lista desde el telefono', async ({ page, request }) => {
    const user = await registerUser(request, { fullName: 'Creadora Movil' });
    await loginInApp(page, user);

    await page.getByTestId('new-list-button').click();
    await page.getByTestId('new-list-name').fill('Super del domingo');
    await page.getByTestId('new-list-submit').click();

    await expect(page.getByTestId('list-card').filter({ hasText: 'Super del domingo' })).toBeVisible();
  });

  test('CP-MOV-008 · agregar un producto y marcarlo como comprado', async ({ page, request }) => {
    const user = await registerUser(request, { fullName: 'Compradora Movil' });
    await createList(request, user.accessToken, 'Despensa movil');
    await loginInApp(page, user);
    await openList(page, 'Despensa movil');

    await page.getByTestId('item-name-input').fill('Pilas AA');
    await page.getByTestId('add-item-button').click();

    const pendiente = page.getByTestId('pending-item').filter({ hasText: 'Pilas AA' });
    await expect(pendiente).toBeVisible();

    await pendiente.click();

    await expect(page.getByTestId('purchased-item').filter({ hasText: 'Pilas AA' })).toBeVisible();
    await expect(page.getByTestId('pending-item').filter({ hasText: 'Pilas AA' })).toHaveCount(0);
  });

  test('CP-MOV-009 · agregar "Pan de caja" con recurrencia de 14 dias', async ({ page, request }) => {
    const user = await registerUser(request, { fullName: 'Recurrente Movil' });
    await createList(request, user.accessToken, 'Quincenal movil');
    await loginInApp(page, user);
    await openList(page, 'Quincenal movil');

    await page.getByTestId('item-name-input').fill('Pan de caja');
    await page.getByTestId('item-recurring-switch').click();
    await expect(page.getByTestId('recurrence-options')).toBeVisible();
    await page.getByTestId('recurrence-preset-14').click();
    await page.getByTestId('add-item-button').click();

    const pendiente = page.getByTestId('pending-item').filter({ hasText: 'Pan de caja' });
    await expect(pendiente).toBeVisible();
    await expect(pendiente.getByTestId('item-recurrence-badge')).toContainText('cada 14 d');

    // Al comprarlo se anuncia cuando volvera
    await pendiente.click();
    const comprado = page.getByTestId('purchased-item').filter({ hasText: 'Pan de caja' });
    await expect(comprado).toBeVisible();
    await expect(comprado.getByTestId('purchased-return-badge')).toContainText('vuelve en 14 d');
  });

  test('CP-MOV-010 · un recurrente vencido se destaca en la lista', async ({ page, request }) => {
    const user = await registerUser(request, { fullName: 'Vencidos Movil' });
    const list = await createList(request, user.accessToken, 'Vencidos movil');
    const item = await createItem(request, user.accessToken, list.id, {
      name: 'Leche entera',
      isRecurring: true,
      recurrenceDays: 7,
    });
    await advanceClock(request, user.accessToken, item.id, 9);

    await loginInApp(page, user);
    await openList(page, 'Vencidos movil');

    const pendiente = page.getByTestId('pending-item').filter({ hasText: 'Leche entera' });
    await expect(pendiente).toBeVisible();
    await expect(pendiente.getByTestId('item-overdue-badge')).toContainText('vencido');
    await expect(page.getByTestId('overdue-summary')).toContainText('1 vencidos');
  });

  test('CP-MOV-011 · la "x" quita el producto de la lista de comprados', async ({ page, request }) => {
    const user = await registerUser(request, { fullName: 'Cierre Movil' });
    const list = await createList(request, user.accessToken, 'Cierre movil');
    const item = await createItem(request, user.accessToken, list.id, { name: 'Servilletas' });
    await request.post(`${API_URL}/items/${item.id}/purchase`, {
      headers: auth(user.accessToken),
    });

    await loginInApp(page, user);
    await openList(page, 'Cierre movil');

    const comprado = page.getByTestId('purchased-item').filter({ hasText: 'Servilletas' });
    await expect(comprado).toBeVisible();

    await comprado.getByTestId('purchased-close').click();
    await expect(page.getByTestId('purchased-item')).toHaveCount(0);
    await expect(page.getByTestId('pending-empty')).toBeVisible();
  });
});
