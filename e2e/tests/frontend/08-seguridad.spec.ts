import { expect, test } from '@playwright/test';
import { API_URL, auth, registerUser } from '../../utils/api-helpers';
import { loginThroughUI, useSession } from '../../utils/ui-helpers';
import { linkFromEmail, waitForEmail } from '../../utils/mailpit';
import { totp } from '../../utils/totp';

test.describe('Frontend web · seguridad de la cuenta', () => {
  test('CP-WEB-034 · recuperar la contraseña desde la interfaz', async ({ page, request }) => {
    const user = await registerUser(request, { fullName: 'Persona Olvidadiza' });

    await page.goto('/app/login');
    await page.getByTestId('go-forgot-password').click();
    await page.getByTestId('forgot-email').fill(user.email);
    await page.getByTestId('forgot-submit').click();
    await expect(page.getByTestId('forgot-sent')).toBeVisible();

    const email = await waitForEmail(request, user.email, 'Restablece tu contraseña');
    await page.goto(linkFromEmail(email, '/app/reset-password'));
    await page.getByTestId('reset-password').fill('ClaveDesdeCorreo123');
    await page.getByTestId('reset-confirm').fill('ClaveDesdeCorreo123');
    await page.getByTestId('reset-submit').click();
    await expect(page.getByTestId('reset-done')).toBeVisible();

    await loginThroughUI(page, user.email, 'ClaveDesdeCorreo123');
  });

  test('CP-WEB-035 · el enlace del correo confirma la cuenta y quita el aviso', async ({ page, request }) => {
    const user = await registerUser(request, { fullName: 'Persona Por Confirmar' });
    await useSession(page, user);

    await page.goto('/app/');
    await expect(page.getByTestId('verify-banner')).toBeVisible();

    const email = await waitForEmail(request, user.email, 'Confirma tu correo');
    await page.goto(linkFromEmail(email, '/app/verify-email'));
    await expect(page.getByTestId('verify-ok')).toContainText(user.email);

    await page.goto('/app/');
    await expect(page.getByTestId('lists-page')).toBeVisible();
    await expect(page.getByTestId('verify-banner')).toHaveCount(0);
  });

  test('CP-WEB-036 · la sesión no queda en localStorage sino en una cookie httpOnly', async ({
    page,
    request,
  }) => {
    const user = await registerUser(request);
    await loginThroughUI(page, user.email, user.password);

    const stored = await page.evaluate(() => JSON.stringify(window.localStorage));
    expect(stored).not.toContain('eyJ'); // ningún JWT en localStorage

    const cookie = (await page.context().cookies()).find((entry) => entry.name === 'lc_rt');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Strict');

    // Recargar recupera la sesión con la cookie
    await page.reload();
    await expect(page.getByTestId('lists-page')).toBeVisible();
  });

  test('CP-WEB-037 · con verificación en dos pasos el login pide el código', async ({ page, request }) => {
    const user = await registerUser(request, { fullName: 'Persona Con Dos Pasos' });
    const { secret } = await (
      await request.post(`${API_URL}/auth/mfa/setup`, { headers: auth(user.accessToken) })
    ).json();
    // Se activa con el código del periodo anterior (se acepta ±1 periodo): así el
    // código actual sigue libre para el login, que no admite reutilizar códigos
    await request.post(`${API_URL}/auth/mfa/enable`, {
      headers: auth(user.accessToken),
      data: { code: totp(secret, -1) },
    });

    await page.goto('/app/login');
    await page.getByTestId('login-email').fill(user.email);
    await page.getByTestId('login-password').fill(user.password);
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('mfa-form')).toBeVisible();
    await page.getByTestId('mfa-code').fill('000000');
    await page.getByTestId('mfa-submit').click();
    await expect(page.getByTestId('mfa-error')).toBeVisible();

    await page.getByTestId('mfa-code').fill(totp(secret));
    await page.getByTestId('mfa-submit').click();
    await expect(page.getByTestId('lists-page')).toBeVisible();
  });
});
