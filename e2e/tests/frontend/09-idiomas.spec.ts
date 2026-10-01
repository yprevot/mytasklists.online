import { expect, test } from '@playwright/test';
import { API_URL, auth, registerUser } from '../../utils/api-helpers';
import { loginThroughUI } from '../../utils/ui-helpers';

test.describe('Frontend web · idiomas', () => {
  test.describe('con el navegador en inglés', () => {
    test.use({ locale: 'en-US' });

    test('CP-WEB-038 · la app se abre en el idioma del navegador', async ({ page, request }) => {
      const user = await registerUser(request);

      await page.goto('/app/login');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.getByTestId('login-card').getByRole('heading')).toHaveText('Sign in');
      await expect(page.getByTestId('language-en')).toHaveAttribute('aria-pressed', 'true');

      // Los errores de la API también llegan en inglés
      await page.getByTestId('login-email').fill(user.email);
      await page.getByTestId('login-password').fill('ClaveEquivocada99');
      await page.getByTestId('login-submit').click();
      await expect(page.getByTestId('login-error')).toHaveText('Incorrect email or password');
    });
  });

  test('CP-WEB-039 · el selector cambia el idioma, lo recuerda y lo guarda en la cuenta', async ({
    page,
    request,
  }) => {
    const user = await registerUser(request, { fullName: 'Cambia Idioma' });
    await loginThroughUI(page, user.email, user.password);
    await expect(page.getByTestId('nav-lists')).toHaveText('Mis listas');

    await page.getByTestId('language-en').first().click();
    await expect(page.getByTestId('nav-lists')).toHaveText('My lists');
    await expect(page.getByTestId('new-list-button')).toContainText('New list');

    // La elección sobrevive a la recarga aunque el navegador esté en español
    await page.reload();
    await expect(page.getByTestId('nav-lists')).toHaveText('My lists');

    // Y el backend la usa para los correos y avisos de la cuenta
    await expect
      .poll(async () => (await (await request.get(`${API_URL}/auth/me`, { headers: auth(user.accessToken) })).json()).locale)
      .toBe('en');

    await page.getByTestId('language-es').first().click();
    await expect(page.getByTestId('nav-lists')).toHaveText('Mis listas');
  });
});
