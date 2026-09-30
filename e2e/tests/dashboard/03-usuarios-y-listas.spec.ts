import { expect, test } from '@playwright/test';
import { SEED, createList, loginUser, registerUser } from '../../utils/api-helpers';
import { useSession } from '../../utils/ui-helpers';

test.describe('Dashboard · usuarios y listas', () => {
  test.beforeEach(async ({ page, request }) => {
    const session = await loginUser(request, SEED.admin.email, SEED.admin.password);
    await useSession(page, session, 'lc.dash');
  });

  test('CP-DASH-009 · buscar un usuario por correo', async ({ page, request }) => {
    const user = await registerUser(request, { fullName: 'Persona Localizable' });

    await page.goto('/dashboard/users');
    await expect(page.getByTestId('users-table')).toBeVisible();

    await page.getByTestId('users-search').fill(user.email);
    await expect(page.getByTestId('users-total')).toContainText('1 usuario');

    const fila = page.locator(`[data-testid="user-row"][data-email="${user.email}"]`);
    await expect(fila).toBeVisible();
    await expect(fila).toContainText('Persona Localizable');
    await expect(fila).toContainText(user.whatsapp);
  });

  test('CP-DASH-010 · desactivar y reactivar una cuenta', async ({ page, request }) => {
    const user = await registerUser(request, { fullName: 'Persona Conmutable' });

    await page.goto('/dashboard/users');
    await page.getByTestId('users-search').fill(user.email);

    const fila = page.locator(`[data-testid="user-row"][data-email="${user.email}"]`);
    await expect(fila).toContainText('activo');

    await fila.getByTestId('toggle-active').click();
    await expect(fila).toContainText('inactivo');

    await fila.getByTestId('toggle-active').click();
    await expect(fila).toContainText('activo');
  });

  test('CP-DASH-011 · las listas del sistema se ven con su propietario', async ({
    page,
    request,
  }) => {
    const user = await registerUser(request, { fullName: 'Persona Con Lista Visible' });
    // Nombre único para que la búsqueda devuelva exactamente una fila
    const nombre = `Lista visible ${Date.now().toString(36)}`;
    await createList(request, user.accessToken, nombre);

    await page.goto('/dashboard/lists');
    await page.getByTestId('lists-search').fill(nombre);

    const fila = page.locator(`[data-testid="list-row"][data-list-name="${nombre}"]`);
    await expect(fila).toBeVisible();
    await expect(page.getByTestId('lists-total')).toContainText('1 lista');
    await expect(fila).toContainText(user.email);
  });
});
