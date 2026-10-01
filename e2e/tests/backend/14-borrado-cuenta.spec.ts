import { expect, test } from '@playwright/test';
import {
  API_URL,
  auth,
  createItem,
  createList,
  getList,
  registerUser,
  shareList,
} from '../../utils/api-helpers';

/**
 * Borrado de la cuenta desde la app (App Store 5.1.1(v) y Google Play): DELETE /users/me.
 */
test.describe('Servicio backend · eliminar la cuenta', () => {
  test('CP-BAJA-001 · exige la contraseña correcta', async ({ request }) => {
    const user = await registerUser(request);

    const sinClave = await request.delete(`${API_URL}/users/me`, { headers: auth(user.accessToken), data: {} });
    expect(sinClave.status()).toBe(400);

    const claveMala = await request.delete(`${API_URL}/users/me`, {
      headers: auth(user.accessToken),
      data: { password: 'ClaveIncorrecta1' },
    });
    expect(claveMala.status()).toBe(400);

    const perfil = await request.get(`${API_URL}/users/me`, { headers: auth(user.accessToken) });
    expect(perfil.ok()).toBeTruthy();
  });

  test('CP-BAJA-002 · borra la cuenta, cierra las sesiones y no deja volver a entrar', async ({ request }) => {
    const user = await registerUser(request);

    const response = await request.delete(`${API_URL}/users/me`, {
      headers: auth(user.accessToken),
      data: { password: user.password },
    });
    expect(response.ok()).toBeTruthy();
    expect(await response.json()).toMatchObject({ ok: true });

    const conToken = await request.get(`${API_URL}/users/me`, { headers: auth(user.accessToken) });
    expect(conToken.status()).toBe(401);

    const refresh = await request.post(`${API_URL}/auth/refresh`, { data: { refreshToken: user.refreshToken } });
    expect(refresh.status()).toBe(401);

    const login = await request.post(`${API_URL}/auth/login`, {
      data: { email: user.email, password: user.password },
    });
    expect(login.status()).toBe(401);

    // El correo queda libre para una cuenta nueva
    const otraVez = await registerUser(request, { email: user.email });
    expect(otraVez.id).not.toBe(user.id);
  });

  test('CP-BAJA-003 · sus listas desaparecen y en las ajenas solo sale ella', async ({ request }) => {
    const owner = await registerUser(request, { fullName: 'Dueña Que Se Va' });
    const guest = await registerUser(request, { fullName: 'Invitado Que Se Queda' });

    const propia = await createList(request, owner.accessToken, 'Lista de la dueña');
    await shareList(request, owner.accessToken, propia.id, guest.email);

    const ajena = await createList(request, guest.accessToken, 'Lista del invitado');
    await shareList(request, guest.accessToken, ajena.id, owner.email);
    const producto = await createItem(request, owner.accessToken, ajena.id, { name: 'Pan de caja' });

    const response = await request.delete(`${API_URL}/users/me`, {
      headers: auth(owner.accessToken),
      data: { password: owner.password },
    });
    expect(response.ok()).toBeTruthy();

    const listaBorrada = await request.get(`${API_URL}/lists/${propia.id}`, { headers: auth(guest.accessToken) });
    expect(listaBorrada.status()).toBe(404);

    const detalle = await getList(request, guest.accessToken, ajena.id);
    expect(detalle.members.map((member: any) => member.email)).not.toContain(owner.email);
    // Sus productos se quedan en la lista ajena, sin autor
    expect(detalle.pending.map((item: any) => item.id)).toContain(producto.id);
  });
});
