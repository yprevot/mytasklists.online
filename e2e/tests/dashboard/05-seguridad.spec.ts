import { expect, test } from '@playwright/test';
import { SEED, loginUser } from '../../utils/api-helpers';
import { useSession } from '../../utils/ui-helpers';

test.describe('Dashboard · seguridad de la cuenta de administracion', () => {
  test('CP-DASH-014 · la pagina de seguridad muestra el estado de 2FA y genera el QR', async ({
    page,
    request,
  }) => {
    const session = await loginUser(request, SEED.admin.email, SEED.admin.password);
    await useSession(page, session, 'lc.dash');

    await page.goto('/dashboard/security');
    await expect(page.getByTestId('security-page')).toBeVisible();
    await expect(page.getByTestId('mfa-status')).toHaveText('inactiva');

    // Solo se genera el QR: sin confirmar el codigo la cuenta sigue igual
    await page.getByTestId('mfa-start').click();
    await expect(page.getByTestId('mfa-setup-form')).toBeVisible();
    await expect(page.getByRole('img', { name: /QR/ })).toBeVisible();
    await expect(page.getByTestId('mfa-secret')).toHaveText(/^[A-Z2-7]{32}$/);
  });
});
