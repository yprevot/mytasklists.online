import { expect, test } from '@playwright/test';
import {
  API_URL,
  BASE_URL,
  DEFAULT_PASSWORD,
  SEED,
  auth,
  loginUser,
  registerUser,
  uniqueEmail,
} from '../../utils/api-helpers';
import { tokenFromEmail, waitForEmail } from '../../utils/mailpit';
import { totp } from '../../utils/totp';

test.describe('Servicio backend · seguridad de la cuenta', () => {
  test('CP-SEC-001 · el registro envía un correo de verificación y el enlace confirma la cuenta', async ({
    request,
  }) => {
    const user = await registerUser(request);
    const me = await (await request.get(`${API_URL}/auth/me`, { headers: auth(user.accessToken) })).json();
    expect(me.emailVerified).toBe(false);

    const email = await waitForEmail(request, user.email, 'Confirma tu correo');
    const token = tokenFromEmail(email, '/app/verify-email');

    const verify = await request.post(`${API_URL}/auth/verify-email`, { data: { token } });
    expect(verify.status()).toBe(200);
    expect((await verify.json()).email).toBe(user.email);

    const after = await (await request.get(`${API_URL}/auth/me`, { headers: auth(user.accessToken) })).json();
    expect(after.emailVerified).toBe(true);

    // El enlace es de un solo uso
    const reuse = await request.post(`${API_URL}/auth/verify-email`, { data: { token } });
    expect(reuse.status()).toBe(400);

    // Ya verificado: no tiene sentido reenviar
    const resend = await request.post(`${API_URL}/auth/verify-email/resend`, {
      headers: auth(user.accessToken),
    });
    expect(resend.status()).toBe(400);
  });

  test('CP-SEC-002 · recuperar la contraseña cambia la clave y cierra todas las sesiones', async ({
    request,
  }) => {
    const user = await registerUser(request);

    const forgot = await request.post(`${API_URL}/auth/forgot-password`, { data: { email: user.email } });
    expect(forgot.status()).toBe(200);

    const email = await waitForEmail(request, user.email, 'Restablece tu contraseña');
    const token = tokenFromEmail(email, '/app/reset-password');

    const reset = await request.post(`${API_URL}/auth/reset-password`, {
      data: { token, newPassword: 'ClaveRecuperada123' },
    });
    expect(reset.status()).toBe(200);

    // La clave vieja deja de servir y la nueva funciona
    const oldLogin = await request.post(`${API_URL}/auth/login`, {
      data: { email: user.email, password: user.password },
    });
    expect(oldLogin.status()).toBe(401);
    const newLogin = await request.post(`${API_URL}/auth/login`, {
      data: { email: user.email, password: 'ClaveRecuperada123' },
    });
    expect(newLogin.status()).toBe(200);
    expect((await newLogin.json()).user.emailVerified).toBe(true);

    // Las sesiones anteriores quedaron revocadas: refresh y access token
    const refresh = await request.post(`${API_URL}/auth/refresh`, {
      data: { refreshToken: user.refreshToken },
    });
    expect(refresh.status()).toBe(401);
    const me = await request.get(`${API_URL}/auth/me`, { headers: auth(user.accessToken) });
    expect(me.status()).toBe(401);

    // El enlace no se puede reutilizar
    const again = await request.post(`${API_URL}/auth/reset-password`, {
      data: { token, newPassword: 'OtraClave12345' },
    });
    expect(again.status()).toBe(400);

    await waitForEmail(request, user.email, 'Tu contraseña de MyTaskLists cambió');
  });

  test('CP-SEC-003 · recuperar contraseña no revela si el correo existe', async ({ request }) => {
    const user = await registerUser(request);

    const existing = await request.post(`${API_URL}/auth/forgot-password`, { data: { email: user.email } });
    const missing = await request.post(`${API_URL}/auth/forgot-password`, {
      data: { email: uniqueEmail('nadie') },
    });

    expect(existing.status()).toBe(200);
    expect(missing.status()).toBe(200);
    expect(await missing.json()).toEqual(await existing.json());
  });

  test('CP-SEC-004 · el login no revela si la cuenta existe ni con qué proveedor se creó', async ({
    request,
  }) => {
    const user = await registerUser(request);
    const wrongPassword = await request.post(`${API_URL}/auth/login`, {
      data: { email: user.email, password: 'ClaveEquivocada1' },
    });
    const unknownUser = await request.post(`${API_URL}/auth/login`, {
      data: { email: uniqueEmail('fantasma'), password: DEFAULT_PASSWORD },
    });

    expect(wrongPassword.status()).toBe(401);
    expect(unknownUser.status()).toBe(401);
    expect((await wrongPassword.json()).message).toBe((await unknownUser.json()).message);
  });

  test('CP-SEC-005 · demasiados intentos fallidos bloquean temporalmente el correo', async ({ request }) => {
    const user = await registerUser(request);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request.post(`${API_URL}/auth/login`, {
        data: { email: user.email, password: `Equivocada${attempt}x` },
      });
      expect(response.status()).toBe(401);
    }

    // Bloqueado aunque ahora la clave sea la buena
    const blocked = await request.post(`${API_URL}/auth/login`, {
      data: { email: user.email, password: user.password },
    });
    expect(blocked.status()).toBe(429);
  });

  test('CP-SEC-006 · cambiar la contraseña revoca los tokens anteriores y devuelve un par nuevo', async ({
    request,
  }) => {
    const user = await registerUser(request);

    const change = await request.patch(`${API_URL}/users/me/password`, {
      headers: auth(user.accessToken),
      data: { currentPassword: user.password, newPassword: 'ClaveCambiada123' },
    });
    expect(change.status()).toBe(200);
    const session = await change.json();
    expect(session.accessToken).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();

    const oldAccess = await request.get(`${API_URL}/auth/me`, { headers: auth(user.accessToken) });
    expect(oldAccess.status()).toBe(401);
    const oldRefresh = await request.post(`${API_URL}/auth/refresh`, {
      data: { refreshToken: user.refreshToken },
    });
    expect(oldRefresh.status()).toBe(401);

    const newAccess = await request.get(`${API_URL}/auth/me`, { headers: auth(session.accessToken) });
    expect(newAccess.status()).toBe(200);
  });

  test('CP-SEC-007 · desactivar una cuenta corta su access token al instante', async ({ request }) => {
    const user = await registerUser(request);
    const admin = await loginUser(request, SEED.admin.email, SEED.admin.password);

    expect((await request.get(`${API_URL}/lists`, { headers: auth(user.accessToken) })).status()).toBe(200);

    await request.patch(`${API_URL}/admin/users/${user.id}`, {
      headers: auth(admin.accessToken),
      data: { isActive: false },
    });
    const cut = await request.get(`${API_URL}/lists`, { headers: auth(user.accessToken) });
    expect(cut.status()).toBe(401);

    // Un administrador no puede desactivarse a si mismo
    const self = await request.patch(`${API_URL}/admin/users/${admin.user.id}`, {
      headers: auth(admin.accessToken),
      data: { isActive: false },
    });
    expect(self.status()).toBe(400);

    await request.patch(`${API_URL}/admin/users/${user.id}`, {
      headers: auth(admin.accessToken),
      data: { isActive: true },
    });
  });

  test('CP-SEC-008 · en clientes web el refresh token viaja en una cookie httpOnly', async ({
    playwright,
  }) => {
    const context = await playwright.request.newContext();
    const user = await registerUser(context);

    const login = await context.post(`${API_URL}/auth/login`, {
      headers: { 'X-Auth-Client': 'web' },
      data: { email: user.email, password: user.password },
    });
    expect(login.status()).toBe(200);
    const body = await login.json();
    expect(body.accessToken).toBeTruthy();
    expect(body).not.toHaveProperty('refreshToken');

    const cookie = login.headers()['set-cookie'] ?? '';
    expect(cookie).toContain('lc_rt=');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/api\/auth/i);

    // La renovación usa la cookie (el contexto la reenvía sola)
    const refresh = await context.post(`${API_URL}/auth/refresh`, {
      headers: { 'X-Auth-Client': 'web' },
      data: {},
    });
    expect(refresh.status()).toBe(200);
    expect(await refresh.json()).not.toHaveProperty('refreshToken');
    await context.dispose();
  });

  test('CP-SEC-009 · verificación en dos pasos: alta, login con código, recuperación y baja', async ({
    request,
  }) => {
    const user = await registerUser(request);

    const setup = await request.post(`${API_URL}/auth/mfa/setup`, { headers: auth(user.accessToken) });
    expect(setup.status()).toBe(200);
    const { secret, otpauthUrl } = await setup.json();
    expect(otpauthUrl).toContain('otpauth://totp/');

    const wrong = await request.post(`${API_URL}/auth/mfa/enable`, {
      headers: auth(user.accessToken),
      data: { code: '000000' },
    });
    expect(wrong.status()).toBe(400);

    const enable = await request.post(`${API_URL}/auth/mfa/enable`, {
      headers: auth(user.accessToken),
      data: { code: totp(secret) },
    });
    expect(enable.status()).toBe(200);
    const { recoveryCodes } = await enable.json();
    expect(recoveryCodes).toHaveLength(8);

    // El login ya no entrega tokens: pide el segundo factor
    const login = await request.post(`${API_URL}/auth/login`, {
      data: { email: user.email, password: user.password },
    });
    const challenge = await login.json();
    expect(challenge.mfaRequired).toBe(true);
    expect(challenge).not.toHaveProperty('accessToken');

    const badCode = await request.post(`${API_URL}/auth/mfa/verify`, {
      data: { mfaToken: challenge.mfaToken, code: '123456' },
    });
    expect(badCode.status()).toBe(401);

    // Un código de recuperación sirve una sola vez
    const recovered = await request.post(`${API_URL}/auth/mfa/verify`, {
      data: { mfaToken: challenge.mfaToken, code: recoveryCodes[0] },
    });
    expect(recovered.status()).toBe(200);
    const session = await recovered.json();
    expect(session.user.mfaEnabled).toBe(true);

    const secondChallenge = await (
      await request.post(`${API_URL}/auth/login`, { data: { email: user.email, password: user.password } })
    ).json();
    const reused = await request.post(`${API_URL}/auth/mfa/verify`, {
      data: { mfaToken: secondChallenge.mfaToken, code: recoveryCodes[0] },
    });
    expect(reused.status()).toBe(401);

    // Desactivar exige un código válido
    const disable = await request.post(`${API_URL}/auth/mfa/disable`, {
      headers: auth(session.accessToken),
      data: { code: recoveryCodes[1] },
    });
    expect(disable.status()).toBe(200);
    const plainLogin = await request.post(`${API_URL}/auth/login`, {
      data: { email: user.email, password: user.password },
    });
    expect((await plainLogin.json()).accessToken).toBeTruthy();
  });

  test('CP-SEC-010 · la búsqueda de personas solo acepta el correo exacto y no expone el WhatsApp', async ({
    request,
  }) => {
    const user = await registerUser(request);
    const objetivo = await registerUser(request, { fullName: 'Objetivo Discreto' });

    const partial = await request.get(`${API_URL}/users/search?q=${encodeURIComponent('Discreto')}`, {
      headers: auth(user.accessToken),
    });
    expect(await partial.json()).toEqual([]);

    const exact = await request.get(`${API_URL}/users/search?q=${encodeURIComponent(objetivo.email)}`, {
      headers: auth(user.accessToken),
    });
    const results = await exact.json();
    expect(results).toHaveLength(1);
    expect(results[0].email).toBe(objetivo.email);
    expect(results[0]).not.toHaveProperty('whatsapp');
  });

  test('CP-SEC-011 · la API y las páginas envían cabeceras de seguridad', async ({ request }) => {
    const api = await request.get(`${API_URL}/health`);
    expect(api.headers()['x-content-type-options']).toBe('nosniff');
    expect(api.headers()['x-powered-by']).toBeUndefined();

    const app = await request.get(`${BASE_URL}/app/`);
    const headers = app.headers();
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});
