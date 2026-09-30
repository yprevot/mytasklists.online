import { expect, test } from '@playwright/test';
import {
  API_URL,
  auth,
  createList,
  getList,
  registerUser,
  shareList,
  uniqueEmail,
  type TestUser,
} from '../../utils/api-helpers';

test.describe('Servicio backend · listas de compras', () => {
  let owner: TestUser;

  test.beforeEach(async ({ request }) => {
    owner = await registerUser(request, { fullName: 'Duena De La Lista' });
  });

  test('CP-LIST-001 · una persona registrada puede tener varias listas', async ({ request }) => {
    await createList(request, owner.accessToken, 'Despensa quincenal');
    await createList(request, owner.accessToken, 'Ferreteria');
    await createList(request, owner.accessToken, 'Fiesta de cumpleanos');

    const response = await request.get(`${API_URL}/lists`, { headers: auth(owner.accessToken) });
    expect(response.ok()).toBeTruthy();

    const lists = await response.json();
    expect(lists).toHaveLength(3);
    expect(lists.map((list: any) => list.name)).toEqual(
      expect.arrayContaining(['Despensa quincenal', 'Ferreteria', 'Fiesta de cumpleanos']),
    );
    expect(lists[0].myRole).toBe('owner');
    expect(lists[0].isShared).toBe(false);
  });

  test('CP-LIST-002 · el detalle separa pendientes y comprados', async ({ request }) => {
    const list = await createList(request, owner.accessToken, 'Detalle');
    expect(list).toMatchObject({
      pendingCount: 0,
      purchasedCount: 0,
      memberCount: 1,
      myRole: 'owner',
    });
    expect(list.pending).toEqual([]);
    expect(list.purchased).toEqual([]);
    expect(list.members).toHaveLength(1);
  });

  test('CP-LIST-003 · se puede renombrar y recolorear la lista', async ({ request }) => {
    const list = await createList(request, owner.accessToken, 'Nombre viejo');

    const response = await request.patch(`${API_URL}/lists/${list.id}`, {
      headers: auth(owner.accessToken),
      data: { name: 'Nombre nuevo', color: '#198754', description: 'Compras del mes' },
    });
    expect(response.ok()).toBeTruthy();

    const updated = await response.json();
    expect(updated.name).toBe('Nombre nuevo');
    expect(updated.color).toBe('#198754');
    expect(updated.description).toBe('Compras del mes');
  });

  test('CP-LIST-004 · compartir una lista con otra persona registrada', async ({ request }) => {
    const invitada = await registerUser(request, { fullName: 'Persona Invitada' });
    const list = await createList(request, owner.accessToken, 'Lista compartida');

    const shared = await shareList(request, owner.accessToken, list.id, invitada.email);
    expect(shared.memberCount).toBe(2);
    expect(shared.isShared).toBe(true);
    expect(shared.members.map((member: any) => member.email)).toContain(invitada.email);

    // La invitada ya ve la lista entre las suyas
    const suyas = await request.get(`${API_URL}/lists`, { headers: auth(invitada.accessToken) });
    const nombres = (await suyas.json()).map((list: any) => list.name);
    expect(nombres).toContain('Lista compartida');

    const detalle = await getList(request, invitada.accessToken, list.id);
    expect(detalle.myRole).toBe('editor');
  });

  test('CP-LIST-005 · no se puede compartir con alguien que no esta registrado', async ({ request }) => {
    const list = await createList(request, owner.accessToken, 'Sin destinatario');

    const response = await request.post(`${API_URL}/lists/${list.id}/share`, {
      headers: auth(owner.accessToken),
      data: { email: uniqueEmail('desconocido') },
    });

    expect(response.status()).toBe(404);
    expect(JSON.stringify(await response.json())).toContain('registrarse');
  });

  test('CP-LIST-006 · quien no es integrante no puede ver la lista', async ({ request }) => {
    const extrano = await registerUser(request, { fullName: 'Persona Ajena' });
    const list = await createList(request, owner.accessToken, 'Lista privada');

    const response = await request.get(`${API_URL}/lists/${list.id}`, {
      headers: auth(extrano.accessToken),
    });
    expect(response.status()).toBe(404);
  });

  test('CP-LIST-007 · cada integrante decide si quiere recibir avisos', async ({ request }) => {
    const invitada = await registerUser(request);
    const list = await createList(request, owner.accessToken, 'Avisos');
    await shareList(request, owner.accessToken, list.id, invitada.email);

    const response = await request.patch(`${API_URL}/lists/${list.id}/notifications`, {
      headers: auth(invitada.accessToken),
      data: { notifyOnChange: false },
    });
    expect(response.ok()).toBeTruthy();

    const detalle = await getList(request, invitada.accessToken, list.id);
    expect(detalle.notifyOnChange).toBe(false);

    // La preferencia es individual: la duena sigue con avisos activos
    const detalleOwner = await getList(request, owner.accessToken, list.id);
    expect(detalleOwner.notifyOnChange).toBe(true);
  });

  test('CP-LIST-008 · la duena puede retirar a un integrante y el pierde acceso', async ({ request }) => {
    const invitada = await registerUser(request);
    const list = await createList(request, owner.accessToken, 'Retiro');
    await shareList(request, owner.accessToken, list.id, invitada.email);

    const response = await request.delete(`${API_URL}/lists/${list.id}/members/${invitada.id}`, {
      headers: auth(owner.accessToken),
    });
    expect(response.ok()).toBeTruthy();

    const sinAcceso = await request.get(`${API_URL}/lists/${list.id}`, {
      headers: auth(invitada.accessToken),
    });
    expect(sinAcceso.status()).toBe(404);
  });

  test('CP-LIST-009 · solo la propietaria puede eliminar la lista', async ({ request }) => {
    const invitada = await registerUser(request);
    const list = await createList(request, owner.accessToken, 'Borrado');
    await shareList(request, owner.accessToken, list.id, invitada.email);

    const intento = await request.delete(`${API_URL}/lists/${list.id}`, {
      headers: auth(invitada.accessToken),
    });
    expect(intento.status()).toBe(403);

    const borrado = await request.delete(`${API_URL}/lists/${list.id}`, {
      headers: auth(owner.accessToken),
    });
    expect(borrado.ok()).toBeTruthy();

    const despues = await request.get(`${API_URL}/lists/${list.id}`, {
      headers: auth(owner.accessToken),
    });
    expect(despues.status()).toBe(404);
  });
});
