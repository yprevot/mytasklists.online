import { expect, test } from '@playwright/test';
import {
  API_URL,
  SEED,
  auth,
  createItem,
  createList,
  loginUser,
  registerUser,
  shareList,
} from '../../utils/api-helpers';
import { useSession } from '../../utils/ui-helpers';

test.describe('Dashboard · bitácora de actividad', () => {
  test('CP-DASH-012 · las acciones sobre las listas quedan registradas', async ({
    page,
    request,
  }) => {
    const ana = await registerUser(request, { fullName: 'Ana Bitacora' });
    const carlos = await registerUser(request, { fullName: 'Carlos Bitacora' });

    const list = await createList(request, ana.accessToken, 'Lista de la bitácora');
    await shareList(request, ana.accessToken, list.id, carlos.email);
    const item = await createItem(request, ana.accessToken, list.id, {
      name: 'Producto de la bitácora',
    });
    await request.post(`${API_URL}/items/${item.id}/purchase`, {
      headers: auth(carlos.accessToken),
    });

    const session = await loginUser(request, SEED.admin.email, SEED.admin.password);
    await useSession(page, session, 'lc.dash');
    await page.goto('/dashboard/activity');

    await expect(page.getByTestId('activity-list')).toBeVisible();
    await expect(page.locator('[data-testid="activity-row"][data-action="list.created"]').first())
      .toBeVisible();
    await expect(page.locator('[data-testid="activity-row"][data-action="item.purchased"]').first())
      .toBeVisible();
    await expect(page.getByTestId('activity-list')).toContainText('Producto de la bitácora');
    await expect(page.getByTestId('activity-list')).toContainText('Lista de la bitácora');
  });

  test('CP-DASH-013 · la navegación lateral recorre las cuatro secciones', async ({
    page,
    request,
  }) => {
    const session = await loginUser(request, SEED.admin.email, SEED.admin.password);
    await useSession(page, session, 'lc.dash');
    await page.goto('/dashboard/');

    await page.getByTestId('nav-usuarios').click();
    await expect(page.getByTestId('users-page')).toBeVisible();

    await page.getByTestId('nav-listas').click();
    await expect(page.getByTestId('lists-page')).toBeVisible();

    await page.getByTestId('nav-bitacora').click();
    await expect(page.getByTestId('activity-page')).toBeVisible();

    await page.getByTestId('nav-resumen').click();
    await expect(page.getByTestId('overview-page')).toBeVisible();
  });
});
