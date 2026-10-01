import { expect, test } from '@playwright/test';
import { registerUser, uniqueWhatsapp } from '../../utils/api-helpers';
import { useSession } from '../../utils/ui-helpers';

test.describe('Frontend web · mi cuenta', () => {
  test('CP-WEB-031 · actualizar nombre, WhatsApp y preferencia de avisos', async ({
    page,
    request,
  }) => {
    const user = await registerUser(request, { fullName: 'Nombre Original' });
    const whatsapp = uniqueWhatsapp();
    await useSession(page, user);

    await page.goto('/app/settings');
    await expect(page.getByTestId('settings-page')).toBeVisible();

    await page.getByTestId('profile-fullname').fill('Nombre Actualizado');
    await page.getByTestId('profile-whatsapp').fill(whatsapp);
    await page.getByTestId('profile-notifications').uncheck();
    await page.getByTestId('profile-save').click();

    await expect(page.getByTestId('toast-title')).toHaveText('Perfil actualizado');
    await page.reload();
    await expect(page.getByTestId('profile-fullname')).toHaveValue('Nombre Actualizado');
    await expect(page.getByTestId('profile-whatsapp')).toHaveValue(whatsapp);
    await expect(page.getByTestId('profile-notifications')).not.toBeChecked();
  });

  test('CP-WEB-032 · cambiar la contraseña desde la interfaz', async ({ page, request }) => {
    const user = await registerUser(request);
    await useSession(page, user);

    await page.goto('/app/settings');
    await page.getByTestId('current-password').fill(user.password);
    await page.getByTestId('new-password').fill('ClaveNueva12345');
    await page.getByTestId('password-save').click();

    await expect(page.getByTestId('toast-title')).toHaveText('Contraseña actualizada');
  });

  test('CP-WEB-033 · el indicador de conexión en vivo se enciende', async ({ page, request }) => {
    const user = await registerUser(request);
    await useSession(page, user);

    await page.goto('/app/');
    await expect(page.getByTestId('connection-status')).toHaveAttribute(
      'data-connected',
      'true',
      { timeout: 20_000 },
    );
    await expect(page.getByTestId('connection-status')).toContainText('En vivo');
  });
});
