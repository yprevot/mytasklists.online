import { expect, test } from '@playwright/test';
import {
  API_URL,
  auth,
  createItem,
  createList,
  registerUser,
  shareList,
} from '../../utils/api-helpers';

test.describe('Servicio backend · avisos y dispositivos móviles', () => {
  test('CP-NOT-001 · registrar y dar de baja el token push del teléfono', async ({ request }) => {
    const user = await registerUser(request);
    const token = `ExponentPushToken[e2e-${Date.now()}]`;

    const alta = await request.post(`${API_URL}/notifications/devices`, {
      headers: auth(user.accessToken),
      data: { token, platform: 'ios', deviceName: 'iPhone de pruebas' },
    });
    expect(alta.status()).toBe(201);
    expect((await alta.json()).platform).toBe('ios');

    const baja = await request.delete(
      `${API_URL}/notifications/devices/${encodeURIComponent(token)}`,
      { headers: auth(user.accessToken) },
    );
    expect(baja.ok()).toBeTruthy();
  });

  test('CP-NOT-002 · la plataforma del dispositivo se valida', async ({ request }) => {
    const user = await registerUser(request);

    const response = await request.post(`${API_URL}/notifications/devices`, {
      headers: auth(user.accessToken),
      data: { token: 'ExponentPushToken[x]', platform: 'blackberry' },
    });
    expect(response.status()).toBe(400);
  });

  test('CP-NOT-005 · solo se aceptan tokens push de Expo', async ({ request }) => {
    const user = await registerUser(request);

    const response = await request.post(`${API_URL}/notifications/devices`, {
      headers: auth(user.accessToken),
      data: { token: 'no-es-un-token-de-expo', platform: 'android' },
    });
    expect(response.status()).toBe(400);
  });

  test('CP-NOT-003 · marcar avisos como leídos', async ({ request }) => {
    const ana = await registerUser(request, { fullName: 'Ana Lectora' });
    const carlos = await registerUser(request, { fullName: 'Carlos Lector' });

    const list = await createList(request, ana.accessToken, 'Avisos leídos');
    await shareList(request, ana.accessToken, list.id, carlos.email);
    await createItem(request, ana.accessToken, list.id, { name: 'Galletas' });

    await expect(async () => {
      const response = await request.get(`${API_URL}/notifications?unread=true`, {
        headers: auth(carlos.accessToken),
      });
      expect((await response.json()).length).toBeGreaterThan(0);
    }).toPass({ timeout: 10_000 });

    const marcar = await request.patch(`${API_URL}/notifications/read-all`, {
      headers: auth(carlos.accessToken),
    });
    expect(marcar.ok()).toBeTruthy();

    const contador = await request.get(`${API_URL}/notifications/unread-count`, {
      headers: auth(carlos.accessToken),
    });
    expect((await contador.json()).count).toBe(0);
  });

  test('CP-NOT-004 · cada quien solo ve sus propios avisos', async ({ request }) => {
    const ana = await registerUser(request, { fullName: 'Ana Privada' });
    const carlos = await registerUser(request, { fullName: 'Carlos Privado' });
    const ajena = await registerUser(request, { fullName: 'Persona Ajena' });

    const list = await createList(request, ana.accessToken, 'Privacidad');
    await shareList(request, ana.accessToken, list.id, carlos.email);
    await createItem(request, ana.accessToken, list.id, { name: 'Secreto' });

    const response = await request.get(`${API_URL}/notifications`, {
      headers: auth(ajena.accessToken),
    });
    expect(await response.json()).toEqual([]);
  });
});
