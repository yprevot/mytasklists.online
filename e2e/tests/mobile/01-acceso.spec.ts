import { expect, test } from '@playwright/test';
import { DEFAULT_PASSWORD, registerUser, uniqueEmail, uniqueWhatsapp } from '../../utils/api-helpers';

/**
 * La app de iOS/Android es la misma base de React Native.
 * Para poder automatizarla con Playwright se ejecuta su build web
 * (react-native-web) en un viewport de telefono.
 */
test.describe('App movil · acceso', () => {
  test('CP-MOV-001 · registro desde el telefono con los cuatro datos', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('login-screen')).toBeVisible();

    await page.getByTestId('go-register').click();
    await expect(page.getByTestId('register-screen')).toBeVisible();

    await page.getByTestId('register-fullname').fill('Movil De Prueba');
    await page.getByTestId('register-email').fill(uniqueEmail('movil'));
    await page.getByTestId('register-whatsapp').fill(uniqueWhatsapp());
    await page.getByTestId('register-password').fill(DEFAULT_PASSWORD);
    await page.getByTestId('register-submit').click();

    await expect(page.getByTestId('lists-screen')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('lists-empty')).toBeVisible();
  });

  test('CP-MOV-002 · el registro valida los campos antes de enviarlos', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('go-register').click();

    await page.getByTestId('register-fullname').fill('Ab');
    await page.getByTestId('register-email').fill('no-es-correo');
    await page.getByTestId('register-whatsapp').fill('12');
    await page.getByTestId('register-password').fill('corta');
    await page.getByTestId('register-submit').click();

    await expect(page.getByTestId('register-fullname-error')).toBeVisible();
    await expect(page.getByTestId('register-email-error')).toBeVisible();
    await expect(page.getByTestId('register-whatsapp-error')).toBeVisible();
    await expect(page.getByTestId('register-password-error')).toBeVisible();
  });

  test('CP-MOV-003 · inicio de sesion con una cuenta existente', async ({ page, request }) => {
    const user = await registerUser(request, { fullName: 'Persona Movil' });

    await page.goto('/');
    await page.getByTestId('login-email').fill(user.email);
    await page.getByTestId('login-password').fill(user.password);
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('lists-screen')).toBeVisible({ timeout: 20_000 });
  });

  test('CP-MOV-004 · credenciales invalidas muestran el error', async ({ page, request }) => {
    const user = await registerUser(request);

    await page.goto('/');
    await page.getByTestId('login-email').fill(user.email);
    await page.getByTestId('login-password').fill('ClaveEquivocada99');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toBeVisible();
  });

  test('CP-MOV-005 · se ofrece inicio de sesion con Google y Apple', async ({ page }) => {
    await page.goto('/');
    // En Android/web se muestra el boton de Google; el de Apple es nativo de iOS
    await expect(page.getByTestId('google-login')).toBeVisible();

    await page.getByTestId('google-login').click();
    await expect(page.getByTestId('social-help-screen')).toBeVisible();
    await expect(page.getByTestId('open-provider')).toBeVisible();
  });

  test('CP-MOV-006 · cerrar sesion desde mi cuenta', async ({ page, request }) => {
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

  test('CP-MOV-015 · recuperar la contrasena desde el telefono', async ({ page, request }) => {
    const user = await registerUser(request, { fullName: 'Persona Movil Olvidadiza' });

    await page.goto('/');
    await page.getByTestId('go-forgot-password').click();
    await expect(page.getByTestId('forgot-screen')).toBeVisible();

    await page.getByTestId('forgot-email').fill(user.email);
    await page.getByTestId('forgot-submit').click();
    await expect(page.getByTestId('forgot-sent')).toBeVisible();
  });
});
