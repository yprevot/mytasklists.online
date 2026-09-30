import { expect, test } from '@playwright/test';
import {
  API_URL,
  advanceClock,
  auth,
  createItem,
  createList,
  getList,
  registerUser,
  type TestUser,
} from '../../utils/api-helpers';

/**
 * El caso descrito en el enunciado:
 *
 *   "Si añado a una lista 'Pan de caja' un lunes y le pongo recurrencia de 14
 *    días, si voy al super el viernes de esa misma semana y lo marco como
 *    comprado (han pasado 5 días), en 14 días se vuelve a activar."
 */
test.describe('Servicio backend · motor de recurrencia', () => {
  let user: TestUser;
  let listId: string;

  test.beforeEach(async ({ request }) => {
    user = await registerUser(request, { fullName: 'Ana Recurrencia' });
    listId = (await createList(request, user.accessToken, 'Recurrencia')).id;
  });

  test('CP-REC-001 · el ciclo se cuenta desde la compra, no desde el alta', async ({ request }) => {
    // Lunes: se agrega con recurrencia de 14 días
    const item = await createItem(request, user.accessToken, listId, {
      name: 'Pan de caja',
      isRecurring: true,
      recurrenceDays: 14,
    });
    expect(item.daysUntilDue).toBe(14);

    // Pasan 5 días (llega el viernes) y se compra
    await advanceClock(request, user.accessToken, item.id, 5);

    const compra = await request.post(`${API_URL}/items/${item.id}/purchase`, {
      headers: auth(user.accessToken),
    });
    const comprado = await compra.json();

    expect(comprado.status).toBe('purchased');
    // La reactivación se programa 14 días después del VIERNES
    expect(comprado.daysUntilReactivation).toBe(14);

    // A los 13 días todavía no vuelve
    const casi = await advanceClock(request, user.accessToken, item.id, 13);
    expect(casi.reactivated).toBe(0);
    expect((await getList(request, user.accessToken, listId)).pendingCount).toBe(0);

    // Al día 14 reaparece en la lista de pendientes
    const vuelve = await advanceClock(request, user.accessToken, item.id, 1);
    expect(vuelve.reactivated).toBe(1);

    const detalle = await getList(request, user.accessToken, listId);
    expect(detalle.pendingCount).toBe(1);
    expect(detalle.purchasedCount).toBe(0);
    expect(detalle.pending[0].name).toBe('Pan de caja');
    expect(detalle.pending[0].cycleCount).toBe(1);
    expect(detalle.pending[0].daysUntilDue).toBe(14);
    expect(detalle.pending[0].purchasedAt).toBeNull();
  });

  test('CP-REC-002 · un recurrente sin comprar se marca como vencido', async ({ request }) => {
    const item = await createItem(request, user.accessToken, listId, {
      name: 'Leche entera',
      isRecurring: true,
      recurrenceDays: 7,
    });

    // Todavía dentro del plazo
    await advanceClock(request, user.accessToken, item.id, 6);
    let detalle = await getList(request, user.accessToken, listId);
    expect(detalle.pending[0].isOverdue).toBe(false);
    expect(detalle.overdueCount).toBe(0);

    // Pasado el plazo: sigue en la lista pero marcado como vencido
    const resultado = await advanceClock(request, user.accessToken, item.id, 3);
    expect(resultado.overdue).toBe(1);

    detalle = await getList(request, user.accessToken, listId);
    expect(detalle.pending[0].isOverdue).toBe(true);
    expect(detalle.pending[0].daysOverdue).toBeGreaterThanOrEqual(2);
    expect(detalle.overdueCount).toBe(1);
    expect(detalle.pendingCount).toBe(1);
  });

  test('CP-REC-003 · comprar un vencido limpia la marca y reinicia el ciclo', async ({ request }) => {
    const item = await createItem(request, user.accessToken, listId, {
      name: 'Huevo',
      isRecurring: true,
      recurrenceDays: 7,
    });
    await advanceClock(request, user.accessToken, item.id, 10);

    let detalle = await getList(request, user.accessToken, listId);
    expect(detalle.pending[0].isOverdue).toBe(true);

    await request.post(`${API_URL}/items/${item.id}/purchase`, { headers: auth(user.accessToken) });

    detalle = await getList(request, user.accessToken, listId);
    expect(detalle.overdueCount).toBe(0);
    expect(detalle.purchased[0].isOverdue).toBe(false);
    expect(detalle.purchased[0].daysUntilReactivation).toBe(7);
  });

  test('CP-REC-004 · cerrar con la "x" no cancela la recurrencia', async ({ request }) => {
    const item = await createItem(request, user.accessToken, listId, {
      name: 'Papel de bano',
      isRecurring: true,
      recurrenceDays: 21,
    });

    await request.post(`${API_URL}/items/${item.id}/purchase`, { headers: auth(user.accessToken) });
    await request.delete(`${API_URL}/items/${item.id}/close`, { headers: auth(user.accessToken) });

    let detalle = await getList(request, user.accessToken, listId);
    expect(detalle.pendingCount).toBe(0);
    expect(detalle.purchasedCount).toBe(0);

    // Aunque se quitó de la vista, vuelve cuando toca
    const resultado = await advanceClock(request, user.accessToken, item.id, 21);
    expect(resultado.reactivated).toBe(1);

    detalle = await getList(request, user.accessToken, listId);
    expect(detalle.pendingCount).toBe(1);
    expect(detalle.pending[0].name).toBe('Papel de bano');
  });

  test('CP-REC-005 · eliminar el producto sí cancela la recurrencia', async ({ request }) => {
    const item = await createItem(request, user.accessToken, listId, {
      name: 'Suavizante',
      isRecurring: true,
      recurrenceDays: 30,
    });
    await request.post(`${API_URL}/items/${item.id}/purchase`, { headers: auth(user.accessToken) });
    await request.delete(`${API_URL}/items/${item.id}`, { headers: auth(user.accessToken) });

    const response = await request.post(`${API_URL}/recurrence/items/${item.id}/advance`, {
      headers: auth(user.accessToken),
      data: { days: 30 },
    });
    expect(response.status()).toBe(404);

    const detalle = await getList(request, user.accessToken, listId);
    expect(detalle.pendingCount).toBe(0);
  });

  test('CP-REC-006 · los ciclos se encadenan una y otra vez', async ({ request }) => {
    const item = await createItem(request, user.accessToken, listId, {
      name: 'Café molido',
      isRecurring: true,
      recurrenceDays: 10,
    });

    for (let cycle = 1; cycle <= 3; cycle += 1) {
      await request.post(`${API_URL}/items/${item.id}/purchase`, {
        headers: auth(user.accessToken),
      });
      const resultado = await advanceClock(request, user.accessToken, item.id, 10);
      expect(resultado.reactivated, `ciclo ${cycle}`).toBe(1);

      const detalle = await getList(request, user.accessToken, listId);
      expect(detalle.pending[0].cycleCount).toBe(cycle);
    }
  });

  test('CP-REC-007 · un producto puntual nunca se reactiva', async ({ request }) => {
    const item = await createItem(request, user.accessToken, listId, { name: 'Foco LED' });
    await request.post(`${API_URL}/items/${item.id}/purchase`, { headers: auth(user.accessToken) });

    const resultado = await advanceClock(request, user.accessToken, item.id, 365);
    expect(resultado.reactivated).toBe(0);

    const detalle = await getList(request, user.accessToken, listId);
    expect(detalle.pendingCount).toBe(0);
    expect(detalle.purchasedCount).toBe(1);
  });
});
