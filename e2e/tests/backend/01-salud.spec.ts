import { expect, test } from '@playwright/test';
import { API_URL } from '../../utils/api-helpers';

test.describe('Servicio backend · salud e infraestructura', () => {
  test('CP-API-001 · el endpoint de salud reporta base de datos y cache activas', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('mytasklists-backend');
    expect(body.database, 'PostgreSQL debe responder').toBe(true);
    expect(body.redis, 'Redis debe responder').toBe(true);
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  test('CP-API-002 · la documentación OpenAPI está publicada', async ({ request }) => {
    const response = await request.get(`${API_URL}/docs-json`);
    expect(response.ok()).toBeTruthy();

    const document = await response.json();
    expect(document.info.title).toBe('MyTaskLists API');
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining(['/api/auth/login', '/api/lists', '/api/lists/{listId}/items']),
    );
  });

  test('CP-API-003 · los métodos de autenticación disponibles se anuncian', async ({ request }) => {
    const response = await request.get(`${API_URL}/auth/providers`);
    expect(response.ok()).toBeTruthy();

    const providers = await response.json();
    expect(providers).toHaveProperty('local', true);
    expect(providers).toHaveProperty('google');
    expect(providers).toHaveProperty('apple');
  });
});
