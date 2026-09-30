import { expect, test } from '@playwright/test';
import {
  API_URL,
  DEFAULT_PASSWORD,
  auth,
  createItem,
  createList,
  registerUser,
  shareList,
  uniqueEmail,
  uniqueWhatsapp,
} from '../../utils/api-helpers';
import { waitForEmail } from '../../utils/mailpit';

/**
 * La interfaz esta en espanol e ingles. La API responde los errores en el idioma
 * de `Accept-Language` y escribe correos y avisos en el idioma de cada persona
 * (`user.locale`), que los clientes igualan al de su interfaz.
 */
const EN = { 'Accept-Language': 'en' };
const ES = { 'Accept-Language': 'es' };

async function setLocale(request: any, token: string, locale: 'es' | 'en') {
  const response = await request.patch(`${API_URL}/users/me`, { headers: auth(token), data: { locale } });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test.describe('Servicio backend · idiomas', () => {
  test('CP-I18N-001 · la API responde los errores en el idioma pedido', async ({ request }) => {
    const user = await registerUser(request);
    const wrong = { email: user.email, password: 'ClaveEquivocada99' };

    const english = await request.post(`${API_URL}/auth/login`, { headers: EN, data: wrong });
    expect(english.status()).toBe(401);
    expect((await english.json()).message).toBe('Incorrect email or password');

    const spanish = await request.post(`${API_URL}/auth/login`, { headers: ES, data: wrong });
    expect((await spanish.json()).message).toBe('Correo o contrasena incorrectos');

    // Sin cabecera se mantiene el espanol de siempre
    const noHeader = await request.post(`${API_URL}/auth/login`, { data: wrong });
    expect((await noHeader.json()).message).toBe('Correo o contrasena incorrectos');

    // Los errores de validacion tambien se traducen
    const invalid = await request.post(`${API_URL}/auth/register`, {
      headers: EN,
      data: { fullName: 'Ab', email: 'no-es-correo', whatsapp: '12', password: 'corta' },
    });
    expect(invalid.status()).toBe(400);
    expect((await invalid.json()).message).toEqual(
      expect.arrayContaining(['The email address is invalid', 'The WhatsApp number is invalid']),
    );
  });

  test('CP-I18N-002 · el registro guarda el idioma y el perfil lo puede cambiar', async ({ request }) => {
    const registered = await request.post(`${API_URL}/auth/register`, {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
      data: {
        fullName: 'English Speaker',
        email: uniqueEmail('english'),
        whatsapp: uniqueWhatsapp(),
        password: DEFAULT_PASSWORD,
      },
    });
    expect(registered.ok()).toBeTruthy();
    const { accessToken, user } = await registered.json();
    expect(user.locale).toBe('en');

    expect((await setLocale(request, accessToken, 'es')).locale).toBe('es');

    const unsupported = await request.patch(`${API_URL}/users/me`, {
      headers: auth(accessToken),
      data: { locale: 'fr' },
    });
    expect(unsupported.status()).toBe(400);
  });

  test('CP-I18N-003 · cada integrante recibe los avisos en su idioma', async ({ request }) => {
    const owner = await registerUser(request, { fullName: 'Duena Hispana' });
    const guest = await registerUser(request, { fullName: 'English Guest' });
    await setLocale(request, guest.accessToken, 'en');

    const list = await createList(request, owner.accessToken, 'Despensa bilingue');
    await shareList(request, owner.accessToken, list.id, guest.email);
    await createItem(request, owner.accessToken, list.id, { name: 'Leche' });
    await createItem(request, guest.accessToken, list.id, { name: 'Bread' });

    const inbox = async (token: string) =>
      (await (await request.get(`${API_URL}/notifications`, { headers: auth(token) })).json()) as {
        title: string;
        body: string;
      }[];

    await expect
      .poll(async () => (await inbox(guest.accessToken)).map((n) => `${n.title} | ${n.body}`))
      .toEqual(
        expect.arrayContaining([
          expect.stringContaining('A list was shared with you'),
          expect.stringContaining('Duena Hispana added "Leche"'),
        ]),
      );
    await expect
      .poll(async () => (await inbox(owner.accessToken)).map((n) => n.body))
      .toEqual(expect.arrayContaining(['English Guest agrego "Bread"']));
  });

  test('CP-I18N-004 · los correos salen en el idioma de la persona', async ({ request }) => {
    const user = await registerUser(request, { fullName: 'Mail Reader' });
    await setLocale(request, user.accessToken, 'en');

    const response = await request.post(`${API_URL}/auth/forgot-password`, {
      headers: EN,
      data: { email: user.email },
    });
    expect((await response.json()).message).toBe(
      'If the email is registered, we sent you a link to reset your password.',
    );

    const email = await waitForEmail(request, user.email, 'Reset your ListaDeCompras password');
    expect(email.text).toContain('Hi Mail Reader,');
    expect(email.html).toContain('lang="en"');
  });
});
