import { expect, test } from '@playwright/test';
import { SEED, loginUser, registerUser } from '../../utils/api-helpers';
import { useSession } from '../../utils/ui-helpers';

test.describe('Dashboard · acceso restringido', () => {
  test('CP-DASH-001 · una cuenta de administración entra al panel', async ({ page }) => {
    await page.goto('/dashboard/login');
    await expect(page.getByTestId('login-card')).toBeVisible();

    await page.getByTestId('login-email').fill(SEED.admin.email);
    await page.getByTestId('login-password').fill(SEED.admin.password);
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('overview-page')).toBeVisible();
    await expect(page.getByTestId('sidebar-user')).toContainText(SEED.admin.email);
  });

  test('CP-DASH-002 · una cuenta normal es rechazada', async ({ page, request }) => {
    const user = await registerUser(request, { fullName: 'Usuario Sin Permisos' });

    await page.goto('/dashboard/login');
    await page.getByTestId('login-email').fill(user.email);
    await page.getByTestId('login-password').fill(user.password);
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toContainText('no tiene acceso');
    await expect(page.getByTestId('overview-page')).toHaveCount(0);
  });

  test('CP-DASH-003 · sin sesión el panel redirige al login', async ({ page }) => {
    await page.goto('/dashboard/');
    await expect(page).toHaveURL(/\/dashboard\/login/);
  });

  test('CP-DASH-004 · cerrar sesión vuelve al login', async ({ page, request }) => {
    const session = await loginUser(request, SEED.admin.email, SEED.admin.password);
    await useSession(page, session, 'lc.dash');

    await page.goto('/dashboard/');
    await expect(page.getByTestId('overview-page')).toBeVisible();

    await page.getByTestId('logout-button').click();
    await expect(page).toHaveURL(/\/dashboard\/login/);
  });
});
