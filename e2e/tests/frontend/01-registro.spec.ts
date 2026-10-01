import { requestRegistration } from '../../utils/registration';
import { waitForEmail,linkFromEmail } from '../../utils/mailpit';
import { expect, test } from '@playwright/test';
import { DEFAULT_PASSWORD, uniqueEmail, uniqueWhatsapp } from '../../utils/api-helpers';

test.describe('Frontend web · registro de usuarios', () => {
  test('CP-WEB-001 · registro con nombre, correo, WhatsApp y contraseña', async ({ page,request }) => {
    const email = uniqueEmail('web');
    const whatsapp = uniqueWhatsapp();

    await page.goto('/app/register');
    await expect(page.getByTestId('register-card')).toBeVisible();

    await page.getByTestId('register-email').fill(email);
    await page.getByTestId('register-submit').click();
    await expect(page.getByTestId('registration-sent')).toBeVisible();
    const mail=await waitForEmail(request,email,'Completa tu registro');
    await page.goto(linkFromEmail(mail,'/app/register/complete'));
    await page.getByTestId('register-fullname').fill('Valeria Ortiz Mendez');
    await page.getByTestId('register-whatsapp').fill(whatsapp);
    await page.getByTestId('register-password').fill(DEFAULT_PASSWORD);
    await page.getByTestId('register-password-confirmation').fill(DEFAULT_PASSWORD);
    await page.getByTestId('register-submit').click();

    // Entra directamente a su área de listas
    await expect(page.getByTestId('lists-page')).toBeVisible();
    await expect(page.getByTestId('lists-empty')).toBeVisible();
    await expect(page.getByTestId('user-menu')).toContainText('Valeria');
  });

  test('CP-WEB-002 · el formulario valida los cuatro campos obligatorios', async ({ page,request }) => {
    const {link}=await requestRegistration(request,uniqueEmail());
    await page.goto(link);
    await page.getByTestId('register-fullname').fill('Ab');

    await page.getByTestId('register-whatsapp').fill('123');
    await page.getByTestId('register-password').fill('corta');
    await page.getByTestId('register-submit').click();

    await expect(page.getByTestId('error-fullname')).toBeVisible();
    await expect(page.getByTestId('register-email')).toHaveAttribute('readonly','');
    await expect(page.getByTestId('error-whatsapp')).toBeVisible();
    await expect(page.getByTestId('error-password')).toBeVisible();
    await expect(page).toHaveURL(/\/app\/register/);
  });

  test('CP-WEB-003 · la pantalla no revela qué correos ya tienen cuenta',async({page})=>{
    await page.goto('/app/register');await page.getByTestId('register-email').fill('carlos@example.com');await page.getByTestId('register-submit').click();
    await expect(page.getByTestId('registration-sent')).toContainText('Si puedes registrarte');
    await expect(page.getByTestId('register-fullname')).toHaveCount(0);
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
