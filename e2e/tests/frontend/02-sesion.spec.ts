import { expect, test } from '@playwright/test';
import { registerUser } from '../../utils/api-helpers';
import { loginThroughUI } from '../../utils/ui-helpers';

test.describe('Frontend web · inicio y cierre de sesion', () => {
  test('CP-WEB-005 · inicio de sesion con correo y contrasena', async ({ page, request }) => {
    const user = await registerUser(request, { fullName: 'Sofia Nunez Lara' });

    await page.goto('/app/login');
    await expect(page.getByTestId('login-card')).toBeVisible();

    await page.getByTestId('login-email').fill(user.email);
    await page.getByTestId('login-password').fill(user.password);
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('lists-page')).toBeVisible();
    await expect(page.getByTestId('user-menu')).toContainText('Sofia');
  });

  test('CP-WEB-006 · credenciales incorrectas muestran el error', async ({ page, request }) => {
    const user = await registerUser(request);

    await page.goto('/app/login');
    await page.getByTestId('login-email').fill(user.email);
    await page.getByTestId('login-password').fill('ClaveEquivocada99');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page.getByTestId('login-error')).toContainText(/incorrect/i);
  });

  test('CP-WEB-007 · sin sesion, cualquier ruta privada lleva al login', async ({ page }) => {
    await page.goto('/app/');
    await expect(page).toHaveURL(/\/app\/login/);

    await page.goto('/app/settings');
    await expect(page).toHaveURL(/\/app\/login/);
  });

  test('CP-WEB-008 · cerrar sesion devuelve al login', async ({ page, request }) => {
    const user = await registerUser(request, { fullName: 'Ricardo Salas' });
    await loginThroughUI(page, user.email, user.password);

    await page.getByTestId('user-menu').click();
    await page.getByTestId('logout-button').click();

    await expect(page).toHaveURL(/\/app\/login/);
    await page.goto('/app/');
    await expect(page).toHaveURL(/\/app\/login/);
  });
});
