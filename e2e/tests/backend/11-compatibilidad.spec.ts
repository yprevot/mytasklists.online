import { expect, test } from '@playwright/test';
import { API_URL, auth, registerUser, SEED } from '../../utils/api-helpers';

/**
 * Las apps de las tiendas se actualizan cuando cada persona quiere. La app movil
 * manda su version en `X-App-Version` y la API corta a las que ya no son
 * compatibles con 426 (docs/COMPATIBILIDAD.md). En el compose de desarrollo la
 * version minima es la 1.0.0.
 */
const oldApp = { 'X-App-Version': '0.9.0', 'X-App-Platform': 'ios' };
const currentApp = { 'X-App-Version': '1.0.0', 'X-App-Platform': 'android' };

test.describe('Servicio backend · compatibilidad con versiones de la app', () => {
  test('CP-COMPAT-001 · la API publica la version minima de la app movil', async ({ request }) => {
    const response = await request.get(`${API_URL}/app/compatibility`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.minVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(body.storeUrls).toHaveProperty('ios');
    expect(body.storeUrls).toHaveProperty('android');
  });

  test('CP-COMPAT-002 · una app por debajo de la minima recibe 426 con un codigo estable', async ({ request }) => {
    const response = await request.get(`${API_URL}/app/compatibility`, { headers: oldApp });
    expect(response.status()).toBe(426);

    const body = await response.json();
    expect(body.code).toBe('APP_UPDATE_REQUIRED');
    expect(body.details.minVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(body.details).toHaveProperty('storeUrl');
    expect(body.message).toContain('Actualiza');
  });

  test('CP-COMPAT-003 · el corte ocurre antes que la sesion: una app vieja no se manda al login', async ({
    request,
  }) => {
    const user = await registerUser(request);

    const withoutToken = await request.get(`${API_URL}/lists`, { headers: oldApp });
    expect(withoutToken.status(), 'debe pedir actualizar, no iniciar sesion').toBe(426);

    const withToken = await request.get(`${API_URL}/lists`, {
      headers: { ...oldApp, ...auth(user.accessToken) },
    });
    expect(withToken.status()).toBe(426);

    const login = await request.post(`${API_URL}/auth/login`, {
      headers: oldApp,
      data: { email: SEED.ana.email, password: SEED.ana.password },
    });
    expect(login.status()).toBe(426);
  });

  test('CP-COMPAT-004 · la version minima, las posteriores y la web sin cabecera se atienden', async ({
    request,
  }) => {
    const user = await registerUser(request);

    const clients: Record<string, string>[] = [currentApp, { 'X-App-Version': '7.3.0' }, {}];
    for (const headers of clients) {
      const response = await request.get(`${API_URL}/lists`, { headers: { ...headers, ...auth(user.accessToken) } });
      expect(response.status(), JSON.stringify(headers)).toBe(200);
    }

    // Un valor ilegible no permite saber si es vieja: se atiende
    const garbled = await request.get(`${API_URL}/app/compatibility`, { headers: { 'X-App-Version': 'abc' } });
    expect(garbled.status()).toBe(200);
  });
});
