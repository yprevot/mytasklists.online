import { requestRegistration } from '../../utils/registration';
import { expect, test } from '@playwright/test';
import {
  API_URL,
  DEFAULT_PASSWORD,
  SEED,
  auth,
  loginUser,
  registerUser,
  uniqueEmail,
  uniqueWhatsapp,
} from '../../utils/api-helpers';

test.describe('Servicio backend · registro e inicio de sesión', () => {
  test('CP-AUTH-001 · registro con nombre completo, correo, WhatsApp y contraseña', async ({ request }) => {
    const payload = {
      fullName: 'María Fernanda Solis',
      email: uniqueEmail('registro'),
      whatsapp: uniqueWhatsapp(),
      password: DEFAULT_PASSWORD,
    };

    const {token}=await requestRegistration(request,payload.email);
    const response = await request.post(`${API_URL}/auth/registration/complete`, { data: {...payload,token,passwordConfirmation:payload.password} });
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.user.email).toBe(payload.email);
    expect(body.user.fullName).toBe(payload.fullName);
    expect(body.user.whatsapp).toBe(payload.whatsapp);
    expect(body.user.provider).toBe('local');
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
  });

  test('CP-AUTH-002 · no se pueden crear cuentas sin verificación previa', async ({request})=>{
    const response=await request.post(`${API_URL}/auth/register`,{data:{fullName:'Registro Antiguo',email:uniqueEmail(),whatsapp:uniqueWhatsapp(),password:DEFAULT_PASSWORD}});
    expect(response.status()).toBe(426);
  });

  test('CP-AUTH-003 · el registro valida el WhatsApp y la longitud de la contraseña', async ({ request }) => {
    const whatsappInvalido = await request.post(`${API_URL}/auth/register`, {
      data: {
        fullName: 'Número Inválido',
        email: uniqueEmail(),
        whatsapp: 'no-es-un-numero',
        password: DEFAULT_PASSWORD,
      },
    });
    expect(whatsappInvalido.status()).toBe(400);
    expect(JSON.stringify(await whatsappInvalido.json())).toContain('WhatsApp');

    const passwordCorta = await request.post(`${API_URL}/auth/register`, {
      data: {
        fullName: 'Clave Corta',
        email: uniqueEmail(),
        whatsapp: uniqueWhatsapp(),
        password: '123',
      },
    });
    expect(passwordCorta.status()).toBe(400);
    expect(JSON.stringify(await passwordCorta.json())).toContain('8 caracteres');
  });

  test('CP-AUTH-004 · inicio de sesión correcto y credenciales inválidas', async ({ request }) => {
    const user = await registerUser(request);

    const ok = await request.post(`${API_URL}/auth/login`, {
      data: { email: user.email, password: user.password },
    });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).user.email).toBe(user.email);

    const malPassword = await request.post(`${API_URL}/auth/login`, {
      data: { email: user.email, password: 'ClaveEquivocada1' },
    });
    expect(malPassword.status()).toBe(401);

    const noExiste = await request.post(`${API_URL}/auth/login`, {
      data: { email: uniqueEmail('fantasma'), password: DEFAULT_PASSWORD },
    });
    expect(noExiste.status()).toBe(401);
  });

  test('CP-AUTH-005 · el refresh token rota y el anterior queda invalidado', async ({ request }) => {
    const user = await registerUser(request);

    const primero = await request.post(`${API_URL}/auth/refresh`, {
      data: { refreshToken: user.refreshToken },
    });
    expect(primero.status()).toBe(200);
    const renovado = await primero.json();
    expect(renovado.refreshToken).not.toBe(user.refreshToken);

    // El token viejo ya no sirve (rotación)
    const reutilizado = await request.post(`${API_URL}/auth/refresh`, {
      data: { refreshToken: user.refreshToken },
    });
    expect(reutilizado.status()).toBe(401);

    // El nuevo si
    const meResponse = await request.get(`${API_URL}/auth/me`, {
      headers: auth(renovado.accessToken),
    });
    expect(meResponse.ok()).toBeTruthy();
    expect((await meResponse.json()).email).toBe(user.email);
  });

  test('CP-AUTH-006 · cerrar sesión invalida el refresh token', async ({ request }) => {
    const user = await registerUser(request);

    const logout = await request.post(`${API_URL}/auth/logout`, {
      headers: auth(user.accessToken),
      data: { refreshToken: user.refreshToken },
    });
    expect(logout.ok()).toBeTruthy();

    const despues = await request.post(`${API_URL}/auth/refresh`, {
      data: { refreshToken: user.refreshToken },
    });
    expect(despues.status()).toBe(401);
  });

  test('CP-AUTH-007 · los endpoints protegidos exigen token', async ({ request }) => {
    for (const path of ['/lists', '/auth/me', '/notifications', '/users/me']) {
      const response = await request.get(`${API_URL}${path}`);
      expect(response.status(), `${path} debería exigir token`).toBe(401);
    }

    const tokenBasura = await request.get(`${API_URL}/lists`, {
      headers: { Authorization: 'Bearer token.invalido.aqui' },
    });
    expect(tokenBasura.status()).toBe(401);
  });

  test('CP-AUTH-008 · la cuenta sembrada de administración tiene rol admin', async ({ request }) => {
    const session = await loginUser(request, SEED.admin.email, SEED.admin.password);
    expect(session.user.role).toBe('admin');
  });
});
