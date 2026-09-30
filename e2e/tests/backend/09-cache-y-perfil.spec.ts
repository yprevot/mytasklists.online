import { expect, test } from '@playwright/test';
import {
  API_URL,
  auth,
  createItem,
  createList,
  registerUser,
  uniqueWhatsapp,
} from '../../utils/api-helpers';

test.describe('Servicio backend · perfil y cache', () => {
  test('CP-PERF-001 · actualizar nombre, WhatsApp y preferencia de avisos', async ({ request }) => {
    const user = await registerUser(request);
    const whatsapp = uniqueWhatsapp();

    const response = await request.patch(`${API_URL}/users/me`, {
      headers: auth(user.accessToken),
      data: { fullName: 'Nombre Actualizado', whatsapp, notificationsEnabled: false },
    });
    expect(response.ok()).toBeTruthy();

    const perfil = await response.json();
    expect(perfil.fullName).toBe('Nombre Actualizado');
    expect(perfil.whatsapp).toBe(whatsapp);
    expect(perfil.notificationsEnabled).toBe(false);
  });

  test('CP-PERF-002 · cambiar la contraseña exige la actual', async ({ request }) => {
    const user = await registerUser(request);

    const sinActual = await request.patch(`${API_URL}/users/me/password`, {
      headers: auth(user.accessToken),
      data: { currentPassword: 'ClaveIncorrecta1', newPassword: 'NuevaClave12345' },
    });
    expect(sinActual.status()).toBe(400);

    const ok = await request.patch(`${API_URL}/users/me/password`, {
      headers: auth(user.accessToken),
      data: { currentPassword: user.password, newPassword: 'NuevaClave12345' },
    });
    expect(ok.ok()).toBeTruthy();

    const login = await request.post(`${API_URL}/auth/login`, {
      data: { email: user.email, password: 'NuevaClave12345' },
    });
    expect(login.ok()).toBeTruthy();
  });

  test('CP-PERF-003 · la búsqueda de personas ayuda a compartir listas', async ({ request }) => {
    const user = await registerUser(request, { fullName: 'Persona Buscadora' });
    const objetivo = await registerUser(request, { fullName: 'Objetivo Encontrable' });

    const response = await request.get(
      `${API_URL}/users/search?q=${encodeURIComponent(objetivo.email)}`,
      { headers: auth(user.accessToken) },
    );
    const resultados = await response.json();

    expect(resultados.map((row: any) => row.email)).toContain(objetivo.email);
    // Uno mismo no aparece en los resultados
    expect(resultados.map((row: any) => row.email)).not.toContain(user.email);
  });

  test('CP-CACHE-001 · la cache de la lista se invalida al cambiar un producto', async ({ request }) => {
    const user = await registerUser(request);
    const list = await createList(request, user.accessToken, 'Cache');

    // Primera lectura: llena la cache
    let detalle = await (
      await request.get(`${API_URL}/lists/${list.id}`, { headers: auth(user.accessToken) })
    ).json();
    expect(detalle.pendingCount).toBe(0);

    await createItem(request, user.accessToken, list.id, { name: 'Producto nuevo' });

    // Segunda lectura inmediata: debe reflejar el alta, no la versión cacheada
    detalle = await (
      await request.get(`${API_URL}/lists/${list.id}`, { headers: auth(user.accessToken) })
    ).json();
    expect(detalle.pendingCount).toBe(1);
    expect(detalle.pending[0].name).toBe('Producto nuevo');
  });
});
