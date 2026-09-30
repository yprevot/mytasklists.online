import { expect, test } from '@playwright/test';
import {
  API_URL,
  auth,
  createItem,
  createList,
  getList,
  registerUser,
  type TestUser,
} from '../../utils/api-helpers';

test.describe('Servicio backend · productos de la lista', () => {
  let user: TestUser;
  let listId: string;

  test.beforeEach(async ({ request }) => {
    user = await registerUser(request);
    listId = (await createList(request, user.accessToken, 'Productos')).id;
  });

  test('CP-ITEM-001 · agregar un producto de una sola vez', async ({ request }) => {
    const item = await createItem(request, user.accessToken, listId, {
      name: 'Pilas AA',
      quantity: 4,
      unit: 'pza',
    });

    expect(item).toMatchObject({
      name: 'Pilas AA',
      quantity: 4,
      unit: 'pza',
      status: 'pending',
      isRecurring: false,
      recurrenceDays: null,
      dueAt: null,
      isOverdue: false,
    });
  });

  test('CP-ITEM-002 · agregar un producto con recurrencia programa su vencimiento', async ({ request }) => {
    const item = await createItem(request, user.accessToken, listId, {
      name: 'Pan de caja',
      isRecurring: true,
      recurrenceDays: 14,
    });

    expect(item.isRecurring).toBe(true);
    expect(item.recurrenceDays).toBe(14);
    expect(item.dueAt).not.toBeNull();
    expect(item.daysUntilDue).toBe(14);
    expect(item.nextActivationAt).toBeNull();
  });

  test('CP-ITEM-003 · marcar recurrencia sin indicar los dias es un error', async ({ request }) => {
    const response = await request.post(`${API_URL}/lists/${listId}/items`, {
      headers: auth(user.accessToken),
      data: { name: 'Sin periodo', isRecurring: true },
    });
    expect(response.status()).toBe(400);
  });

  test('CP-ITEM-004 · la recurrencia acepta entre 1 y 365 dias', async ({ request }) => {
    for (const recurrenceDays of [0, 366, -3]) {
      const response = await request.post(`${API_URL}/lists/${listId}/items`, {
        headers: auth(user.accessToken),
        data: { name: 'Fuera de rango', isRecurring: true, recurrenceDays },
      });
      expect(response.status(), `recurrenceDays=${recurrenceDays}`).toBe(400);
    }
  });

  test('CP-ITEM-005 · al comprar, el producto pasa a la lista de comprados', async ({ request }) => {
    const item = await createItem(request, user.accessToken, listId, { name: 'Cafe molido' });

    const response = await request.post(`${API_URL}/items/${item.id}/purchase`, {
      headers: auth(user.accessToken),
    });
    expect(response.ok()).toBeTruthy();

    const comprado = await response.json();
    expect(comprado.status).toBe('purchased');
    expect(comprado.purchasedAt).not.toBeNull();
    expect(comprado.purchasedByName).toBe(user.fullName);

    const detalle = await getList(request, user.accessToken, listId);
    expect(detalle.pendingCount).toBe(0);
    expect(detalle.purchasedCount).toBe(1);
    expect(detalle.purchased[0].name).toBe('Cafe molido');
  });

  test('CP-ITEM-006 · deshacer la compra regresa el producto a pendientes', async ({ request }) => {
    const item = await createItem(request, user.accessToken, listId, { name: 'Tortillas' });
    await request.post(`${API_URL}/items/${item.id}/purchase`, { headers: auth(user.accessToken) });

    const response = await request.post(`${API_URL}/items/${item.id}/restore`, {
      headers: auth(user.accessToken),
    });
    expect(response.ok()).toBeTruthy();
    expect((await response.json()).status).toBe('pending');

    const detalle = await getList(request, user.accessToken, listId);
    expect(detalle.pendingCount).toBe(1);
    expect(detalle.purchasedCount).toBe(0);
  });

  test('CP-ITEM-007 · la "x" quita el producto de la lista de comprados', async ({ request }) => {
    const item = await createItem(request, user.accessToken, listId, { name: 'Servilletas' });
    await request.post(`${API_URL}/items/${item.id}/purchase`, { headers: auth(user.accessToken) });

    const response = await request.delete(`${API_URL}/items/${item.id}/close`, {
      headers: auth(user.accessToken),
    });
    expect(response.ok()).toBeTruthy();

    const detalle = await getList(request, user.accessToken, listId);
    expect(detalle.pendingCount).toBe(0);
    expect(detalle.purchasedCount).toBe(0);
  });

  test('CP-ITEM-008 · vaciar de golpe la lista de comprados', async ({ request }) => {
    for (const name of ['Arroz', 'Frijol', 'Azucar']) {
      const item = await createItem(request, user.accessToken, listId, { name });
      await request.post(`${API_URL}/items/${item.id}/purchase`, {
        headers: auth(user.accessToken),
      });
    }

    const response = await request.delete(`${API_URL}/lists/${listId}/items/purchased`, {
      headers: auth(user.accessToken),
    });
    expect(await response.json()).toEqual({ cleared: 3 });

    const detalle = await getList(request, user.accessToken, listId);
    expect(detalle.purchasedCount).toBe(0);
  });

  test('CP-ITEM-009 · editar un producto y activarle la recurrencia despues', async ({ request }) => {
    const item = await createItem(request, user.accessToken, listId, { name: 'Detergente' });

    const response = await request.patch(`${API_URL}/items/${item.id}`, {
      headers: auth(user.accessToken),
      data: { name: 'Detergente liquido', quantity: 2, isRecurring: true, recurrenceDays: 30 },
    });
    expect(response.ok()).toBeTruthy();

    const editado = await response.json();
    expect(editado.name).toBe('Detergente liquido');
    expect(editado.quantity).toBe(2);
    expect(editado.isRecurring).toBe(true);
    expect(editado.recurrenceDays).toBe(30);
    expect(editado.dueAt).not.toBeNull();
  });

  test('CP-ITEM-010 · eliminar un producto lo borra de la lista', async ({ request }) => {
    const item = await createItem(request, user.accessToken, listId, { name: 'Producto de mas' });

    const response = await request.delete(`${API_URL}/items/${item.id}`, {
      headers: auth(user.accessToken),
    });
    expect(response.ok()).toBeTruthy();

    const detalle = await getList(request, user.accessToken, listId);
    expect(detalle.pendingCount).toBe(0);
  });

  test('CP-ITEM-011 · quien no pertenece a la lista no puede agregar productos', async ({ request }) => {
    const extrano = await registerUser(request);

    const response = await request.post(`${API_URL}/lists/${listId}/items`, {
      headers: auth(extrano.accessToken),
      data: { name: 'Intruso' },
    });
    expect(response.status()).toBe(404);
  });
});
