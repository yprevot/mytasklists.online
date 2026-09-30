import { expect, test } from '@playwright/test';
import {
  API_URL,
  auth,
  createItem,
  createList,
  registerUser,
  shareList,
} from '../../utils/api-helpers';

test.describe('App movil · sincronizacion y avisos', () => {
  test('CP-MOV-012 · lo que otra persona marca aparece al instante en el telefono', async ({
    page,
    request,
  }) => {
    const carlos = await registerUser(request, { fullName: 'Carlos Telefono' });
    const ana = await registerUser(request, { fullName: 'Ana Escritorio' });

    const list = await createList(request, ana.accessToken, 'Compartida movil');
    await shareList(request, ana.accessToken, list.id, carlos.email);
    const item = await createItem(request, ana.accessToken, list.id, { name: 'Leche entera' });

    await page.goto('/');
    await page.getByTestId('login-email').fill(carlos.email);
    await page.getByTestId('login-password').fill(carlos.password);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('lists-screen')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('list-card').filter({ hasText: 'Compartida movil' }).click();
    await expect(page.getByTestId('pending-item').filter({ hasText: 'Leche entera' })).toBeVisible();

    // Ana la compra desde la web
    await request.post(`${API_URL}/items/${item.id}/purchase`, { headers: auth(ana.accessToken) });

    // El telefono de Carlos se actualiza solo
    await expect(page.getByTestId('purchased-item').filter({ hasText: 'Leche entera' })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('CP-MOV-013 · llega el aviso emergente dentro de la app', async ({ page, request }) => {
    const carlos = await registerUser(request, { fullName: 'Carlos Notificado' });
    const ana = await registerUser(request, { fullName: 'Ana Notificadora' });

    const list = await createList(request, ana.accessToken, 'Avisos movil');
    await shareList(request, ana.accessToken, list.id, carlos.email);

    await page.goto('/');
    await page.getByTestId('login-email').fill(carlos.email);
    await page.getByTestId('login-password').fill(carlos.password);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('lists-screen')).toBeVisible({ timeout: 20_000 });

    await createItem(request, ana.accessToken, list.id, { name: 'Manzanas' });

    const toast = page.getByTestId('in-app-toast');
    await expect(toast).toBeVisible({ timeout: 20_000 });
    await expect(toast.getByTestId('toast-title')).toHaveText('Avisos movil');
    await expect(toast.getByTestId('toast-body')).toContainText('Ana Notificadora');
    await expect(toast.getByTestId('toast-body')).toContainText('Manzanas');
  });

  test('CP-MOV-014 · compartir una lista desde el telefono', async ({ page, request }) => {
    const ana = await registerUser(request, { fullName: 'Ana Comparte Movil' });
    const carlos = await registerUser(request, { fullName: 'Carlos Recibe Movil' });
    await createList(request, ana.accessToken, 'Para compartir movil');

    await page.goto('/');
    await page.getByTestId('login-email').fill(ana.email);
    await page.getByTestId('login-password').fill(ana.password);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('lists-screen')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('list-card').filter({ hasText: 'Para compartir movil' }).click();
    await page.getByTestId('share-button').click();
    await page.getByTestId('share-email-input').fill(carlos.email);
    await page.getByTestId('share-submit').click();

    await expect(page.getByTestId('list-detail-screen')).toContainText('2 personas', {
      timeout: 20_000,
    });
  });
});
