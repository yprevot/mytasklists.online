import { expect, test } from '@playwright/test';
import { API_URL } from '../../utils/api-helpers';

/**
 * Alta en el boletín (Listmonk). El compose de desarrollo no configura Listmonk:
 * aquí se comprueba que la API lo anuncia como desactivado y que valida y rechaza
 * las altas sin llamar a nadie. El alta real se prueba contra Listmonk en producción.
 */
test.describe('Servicio backend · boletín', () => {
  test('CP-NEWS-001 · sin Listmonk configurado el boletín se anuncia desactivado', async ({ request }) => {
    const response = await request.get(`${API_URL}/newsletter`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ enabled: false });
  });

  test('CP-NEWS-002 · el alta valida el correo y sin Listmonk responde 503', async ({ request }) => {
    const invalid = await request.post(`${API_URL}/newsletter/subscribe`, { data: { email: 'no-es-un-correo' } });
    expect(invalid.status()).toBe(400);

    const unavailable = await request.post(`${API_URL}/newsletter/subscribe`, {
      data: { email: 'boletin@example.com' },
    });
    expect(unavailable.status()).toBe(503);
    expect((await unavailable.json()).message).toBe('La suscripción al boletín no está disponible');

    const english = await request.post(`${API_URL}/newsletter/subscribe`, {
      data: { email: 'boletin@example.com' },
      headers: { 'Accept-Language': 'en' },
    });
    expect((await english.json()).message).toBe('The newsletter is not available');
  });
});
