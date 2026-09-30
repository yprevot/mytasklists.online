import { expect, test } from '@playwright/test';
import {
  SEED,
  advanceClock,
  createItem,
  createList,
  loginUser,
  registerUser,
} from '../../utils/api-helpers';
import { useSession } from '../../utils/ui-helpers';

test.describe('Dashboard · resumen de indicadores', () => {
  test.beforeEach(async ({ page, request }) => {
    const session = await loginUser(request, SEED.admin.email, SEED.admin.password);
    await useSession(page, session, 'lc.dash');
  });

  test('CP-DASH-005 · los cuatro indicadores principales estan visibles', async ({ page }) => {
    await page.goto('/dashboard/');
    await expect(page.getByTestId('overview-page')).toBeVisible();

    for (const kpi of ['kpi-users', 'kpi-lists', 'kpi-recurring', 'kpi-overdue']) {
      await expect(page.getByTestId(kpi)).toBeVisible();
      await expect(page.getByTestId(`${kpi}-value`)).toHaveText(/^\d+$/);
    }

    await expect(page.getByTestId('bar-chart')).toBeVisible();
    await expect(page.getByTestId('provider-breakdown')).toContainText('local');
    await expect(page.getByTestId('items-breakdown')).toContainText('Pendientes');
  });

  test('CP-DASH-006 · el numero de usuarios crece al registrarse alguien', async ({
    page,
    request,
  }) => {
    await page.goto('/dashboard/');
    const antes = Number(await page.getByTestId('kpi-users-value').innerText());

    await registerUser(request, { fullName: 'Persona Contada' });

    await expect(async () => {
      await page.reload();
      const ahora = Number(await page.getByTestId('kpi-users-value').innerText());
      expect(ahora).toBeGreaterThan(antes);
    }).toPass({ timeout: 30_000 });
  });

  test('CP-DASH-007 · el motor de recurrencia se ejecuta desde el panel', async ({ page }) => {
    await page.goto('/dashboard/');

    await page.getByTestId('run-recurrence').click();
    await expect(page.getByTestId('recurrence-result')).toContainText(/reactivados/);
  });

  test('CP-DASH-008 · los productos recurrentes vencidos se contabilizan', async ({
    page,
    request,
  }) => {
    const user = await registerUser(request, { fullName: 'Persona Con Vencidos' });
    const list = await createList(request, user.accessToken, 'Lista con vencidos');
    const item = await createItem(request, user.accessToken, list.id, {
      name: 'Producto vencido dashboard',
      isRecurring: true,
      recurrenceDays: 3,
    });

    await page.goto('/dashboard/');
    const antes = Number(await page.getByTestId('kpi-overdue-value').innerText());

    await advanceClock(request, user.accessToken, item.id, 5);

    await expect(async () => {
      await page.reload();
      const ahora = Number(await page.getByTestId('kpi-overdue-value').innerText());
      expect(ahora).toBeGreaterThan(antes);
    }).toPass({ timeout: 30_000 });
  });
});
