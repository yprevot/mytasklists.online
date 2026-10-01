import { expect, test } from '@playwright/test';
import {
  API_URL,
  SEED,
  auth,
  createItem,
  createList,
  loginUser,
  registerUser,
} from '../../utils/api-helpers';

test.describe('Servicio backend · panel de administración', () => {
  let adminToken: string;

  test.beforeAll(async ({ playwright }) => {
    const context = await playwright.request.newContext();
    adminToken = (await loginUser(context, SEED.admin.email, SEED.admin.password)).accessToken;
    await context.dispose();
  });

  test('CP-ADM-001 · los indicadores globales están disponibles', async ({ request }) => {
    const response = await request.get(`${API_URL}/admin/stats`, { headers: auth(adminToken) });
    expect(response.ok()).toBeTruthy();

    const stats = await response.json();
    expect(stats.users.total).toBeGreaterThan(0);
    expect(stats.lists).toHaveProperty('shared');
    expect(stats.items).toHaveProperty('recurring');
    expect(stats.items).toHaveProperty('overdue');
    expect(stats.notifications).toHaveProperty('unread');
  });

  test('CP-ADM-002 · la serie diaria devuelve un punto por día', async ({ request }) => {
    const response = await request.get(`${API_URL}/admin/timeseries?days=7`, {
      headers: auth(adminToken),
    });
    const series = await response.json();

    expect(series).toHaveLength(7);
    expect(series[0]).toEqual(
      expect.objectContaining({
        day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        created: expect.any(Number),
        purchased: expect.any(Number),
        signups: expect.any(Number),
      }),
    );
  });

  test('CP-ADM-003 · la bitácora registra lo que ocurre en las listas', async ({ request }) => {
    const user = await registerUser(request, { fullName: 'Persona Bitácora' });
    const list = await createList(request, user.accessToken, 'Bitácora e2e');
    await createItem(request, user.accessToken, list.id, { name: 'Producto de bitácora' });

    await expect(async () => {
      const response = await request.get(`${API_URL}/admin/activity?limit=50`, {
        headers: auth(adminToken),
      });
      const rows = await response.json();
      const acciones = rows.map((row: any) => row.action);
      expect(acciones).toContain('item.created');
      expect(rows.some((row: any) => row.summary === 'Producto de bitácora')).toBe(true);
    }).toPass({ timeout: 10_000 });
  });

  test('CP-ADM-004 · listado y búsqueda de usuarios', async ({ request }) => {
    const user = await registerUser(request, { fullName: 'Persona Buscable' });

    const response = await request.get(
      `${API_URL}/admin/users?page=1&limit=20&search=${encodeURIComponent(user.email)}`,
      { headers: auth(adminToken) },
    );
    const page = await response.json();

    expect(page.total).toBe(1);
    expect(page.data[0].email).toBe(user.email);
    expect(page.data[0]).not.toHaveProperty('passwordHash');
  });

  test('CP-ADM-005 · desactivar una cuenta impide iniciar sesión', async ({ request }) => {
    const user = await registerUser(request, { fullName: 'Persona Suspendida' });

    const patch = await request.patch(`${API_URL}/admin/users/${user.id}`, {
      headers: auth(adminToken),
      data: { isActive: false },
    });
    expect((await patch.json()).isActive).toBe(false);

    const login = await request.post(`${API_URL}/auth/login`, {
      data: { email: user.email, password: user.password },
    });
    expect(login.status()).toBe(403);

    // Se puede reactivar
    await request.patch(`${API_URL}/admin/users/${user.id}`, {
      headers: auth(adminToken),
      data: { isActive: true },
    });
    const otraVez = await request.post(`${API_URL}/auth/login`, {
      data: { email: user.email, password: user.password },
    });
    expect(otraVez.ok()).toBeTruthy();
  });

  test('CP-ADM-006 · una cuenta normal no puede entrar a administración', async ({ request }) => {
    const user = await registerUser(request);

    for (const path of ['/admin/stats', '/admin/users', '/admin/lists', '/admin/activity']) {
      const response = await request.get(`${API_URL}${path}`, { headers: auth(user.accessToken) });
      expect(response.status(), path).toBe(403);
    }

    const recurrencia = await request.post(`${API_URL}/recurrence/run`, {
      headers: auth(user.accessToken),
    });
    expect(recurrencia.status()).toBe(403);
  });

  test('CP-ADM-007 · el motor de recurrencia se puede disparar manualmente', async ({ request }) => {
    const response = await request.post(`${API_URL}/recurrence/run`, {
      headers: auth(adminToken),
    });
    expect(response.ok()).toBeTruthy();

    const resultado = await response.json();
    expect(resultado).toEqual(
      expect.objectContaining({
        reactivated: expect.any(Number),
        overdue: expect.any(Number),
        ranAt: expect.any(String),
      }),
    );
  });

  test('CP-ADM-008 · listado de listas con propietario y conteos', async ({ request }) => {
    const user = await registerUser(request, { fullName: 'Persona Con Lista' });
    await createList(request, user.accessToken, 'Lista visible en admin');

    const response = await request.get(
      `${API_URL}/admin/lists?search=${encodeURIComponent('Lista visible en admin')}`,
      { headers: auth(adminToken) },
    );
    const page = await response.json();

    expect(page.total).toBeGreaterThanOrEqual(1);
    expect(page.data[0]).toEqual(
      expect.objectContaining({
        name: 'Lista visible en admin',
        ownerEmail: user.email,
        memberCount: 1,
      }),
    );
  });
});
