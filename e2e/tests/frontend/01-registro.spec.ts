import { expect, test } from '@playwright/test';
import { DEFAULT_PASSWORD, uniqueEmail, uniqueWhatsapp } from '../../utils/api-helpers';

test.describe('Frontend web · registro de usuarios', () => {
  test('CP-WEB-001 · registro con nombre, correo, WhatsApp y contraseña', async ({ page }) => {
    const email = uniqueEmail('web');
    const whatsapp = uniqueWhatsapp();

    await page.goto('/app/register');
    await expect(page.getByTestId('register-card')).toBeVisible();

    await page.getByTestId('register-fullname').fill('Valeria Ortiz Mendez');
    await page.getByTestId('register-email').fill(email);
    await page.getByTestId('register-whatsapp').fill(whatsapp);
    await page.getByTestId('register-password').fill(DEFAULT_PASSWORD);
    await page.getByTestId('register-submit').click();

    // Entra directamente a su área de listas
    await expect(page.getByTestId('lists-page')).toBeVisible();
    await expect(page.getByTestId('lists-empty')).toBeVisible();
    await expect(page.getByTestId('user-menu')).toContainText('Valeria');
  });

  test('CP-WEB-002 · el formulario valida los cuatro campos obligatorios', async ({ page }) => {
    await page.goto('/app/register');

    await page.getByTestId('register-fullname').fill('Ab');
    await page.getByTestId('register-email').fill('correo-malo');
    await page.getByTestId('register-whatsapp').fill('123');
    await page.getByTestId('register-password').fill('corta');
    await page.getByTestId('register-submit').click();

    await expect(page.getByTestId('error-fullname')).toBeVisible();
    await expect(page.getByTestId('error-email')).toBeVisible();
    await expect(page.getByTestId('error-whatsapp')).toBeVisible();
    await expect(page.getByTestId('error-password')).toBeVisible();
    await expect(page).toHaveURL(/\/app\/register/);
  });

  test('CP-WEB-003 · avisa cuando el correo ya está registrado', async ({ page, request }) => {
    const email = uniqueEmail('duplicado');
    const { registerUser } = await import('../../utils/api-helpers');
    await registerUser(request, { email });

    await page.goto('/app/register');
    await page.getByTestId('register-fullname').fill('Persona Repetida');
    await page.getByTestId('register-email').fill(email);
    await page.getByTestId('register-whatsapp').fill(uniqueWhatsapp());
    await page.getByTestId('register-password').fill(DEFAULT_PASSWORD);
    await page.getByTestId('register-submit').click();

    await expect(page.getByTestId('register-error')).toContainText('correo');
  });

  test('CP-WEB-004 · se ofrece registro con Google y con Apple', async ({ page }) => {
    // La interfaz decide qué mostrar con lo que responde /auth/providers: se espera esa respuesta
    const providersResponse = page.waitForResponse((response) => response.url().includes('/auth/providers'));
    await page.goto('/app/register');
    const providers = (await (await providersResponse).json()) as { google: boolean; apple: boolean };

    // Si el despliegue tiene credenciales OAuth se ven los botones;
    // si no, se explica que no están configurados.
    if (providers.google || providers.apple) {
      await expect(page.getByTestId('social-buttons')).toBeVisible();
      if (providers.google) {
        await expect(page.getByTestId('google-login')).toHaveAttribute('href', /\/auth\/google$/);
      }
      if (providers.apple) {
        await expect(page.getByTestId('apple-login')).toHaveAttribute('href', /\/auth\/apple$/);
      }
    } else {
      await expect(page.getByTestId('social-disabled')).toContainText('Google y Apple');
    }
  });
});
