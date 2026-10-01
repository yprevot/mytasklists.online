import { expect, test } from '@playwright/test';
import { DEFAULT_PASSWORD, registerUser, uniqueEmail, uniqueWhatsapp } from '../../utils/api-helpers';

/**
 * La app de iOS/Android es la misma base de React Native.
 * Para poder automatizarla con Playwright se ejecuta su build web
 * (react-native-web) en un viewport de teléfono.
 */
test.describe('App móvil · acceso', () => {
  test('CP-MOV-001 · solicita enlace de registro desde el teléfono', async ({ page }) => {
    await page.goto('/');await page.getByTestId('go-register').click();
    await page.getByTestId('register-email').fill(uniqueEmail('movil'));await page.getByTestId('register-submit').click();
    await expect(page.getByTestId('registration-sent')).toBeVisible();await expect(page.getByTestId('register-fullname')).toHaveCount(0);
  });
  test('CP-MOV-002 · correo inválido no inicia el registro', async ({ page }) => {
    await page.goto('/');await page.getByTestId('go-register').click();await page.getByTestId('register-email').fill('no-es-correo');await page.getByTestId('register-submit').click();
    await expect(page.getByTestId('register-error')).toBeVisible();await expect(page.getByTestId('registration-sent')).toHaveCount(0);
  });

  test('CP-MOV-003 · inicio de sesión con una cuenta existente', async ({ page, request }) => {
    const user = await registerUser(request, { fullName: 'Persona Móvil' });

    await page.goto('/');
    await page.getByTestId('login-email').fill(user.email);
    await page.getByTestId('login-password').fill(user.password);
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('lists-screen')).toBeVisible({ timeout: 20_000 });
  });

  test('CP-MOV-004 · credenciales inválidas muestran el error', async ({ page, request }) => {
    const user = await registerUser(request);

    await page.goto('/');
    await page.getByTestId('login-email').fill(user.email);
    await page.getByTestId('login-password').fill('ClaveEquivocada99');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toBeVisible();
  });

  test('CP-MOV-005 · se ofrece inicio de sesión con Google y Apple', async ({ page }) => {
    await page.goto('/');
    // En Android/web se muestra el botón de Google; el de Apple es nativo de iOS
    await expect(page.getByTestId('google-login')).toBeVisible();

    await page.getByTestId('google-login').click();
    await expect(page.getByTestId('social-help-screen')).toBeVisible();
    await expect(page.getByTestId('open-provider')).toBeVisible();
  });

  test('CP-MOV-006 · cerrar sesión desde mi cuenta', async ({ page, request }) => {
    const user = await registerUser(request, { fullName: 'Persona Que Sale' });

    await page.goto('/');
    await page.getByTestId('login-email').fill(user.email);
    await page.getByTestId('login-password').fill(user.password);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('lists-screen')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('open-settings').click();
    await expect(page.getByTestId('settings-screen')).toBeVisible();
    await expect(page.getByTestId('settings-screen')).toContainText(user.email);

    await page.getByTestId('logout-button').click();
    await expect(page.getByTestId('login-screen')).toBeVisible();
  });

  test('CP-MOV-015 · recuperar la contraseña desde el teléfono', async ({ page, request }) => {
    const user = await registerUser(request, { fullName: 'Persona Móvil Olvidadiza' });

    await page.goto('/');
    await page.getByTestId('go-forgot-password').click();
    await expect(page.getByTestId('forgot-screen')).toBeVisible();

    await page.getByTestId('forgot-email').fill(user.email);
    await page.getByTestId('forgot-submit').click();
    await expect(page.getByTestId('forgot-sent')).toBeVisible();
  });
});
