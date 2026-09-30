import { expect, test } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
import {
  API_URL,
  BASE_URL,
  auth,
  createItem,
  createList,
  registerUser,
  shareList,
} from '../../utils/api-helpers';

const connect = (token: string): Promise<Socket> =>
  new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token },
      reconnection: false,
    });
    const timer = setTimeout(() => reject(new Error('timeout al conectar el socket')), 15_000);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

const waitFor = <T,>(socket: Socket, event: string, timeoutMs = 15_000): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no llegó el evento "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

test.describe('Servicio backend · sincronización en tiempo real', () => {
  const sockets: Socket[] = [];

  test.afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.disconnect());
  });

  test('CP-RT-001 · el WebSocket rechaza conexiones sin token válido', async () => {
    await expect(connect('token-invalido')).rejects.toThrow();
  });

  test('CP-RT-002 · quien comparte lista entra a su sala al conectarse', async ({ request }) => {
    const ana = await registerUser(request, { fullName: 'Ana Tiempo Real' });
    const list = await createList(request, ana.accessToken, 'Sala compartida');

    const socket = await connect(ana.accessToken);
    sockets.push(socket);

    const hello = await waitFor<{ userId: string; lists: string[] }>(socket, 'connected');
    expect(hello.userId).toBe(ana.id);
    expect(hello.lists).toContain(list.id);
  });

  test('CP-RT-003 · al marcar un producto, la otra persona lo ve al instante', async ({ request }) => {
    const ana = await registerUser(request, { fullName: 'Ana Compradora' });
    const carlos = await registerUser(request, { fullName: 'Carlos Compartido' });

    const list = await createList(request, ana.accessToken, 'Super del sábado');
    await shareList(request, ana.accessToken, list.id, carlos.email);

    const item = await createItem(request, ana.accessToken, list.id, { name: 'Leche entera' });

    const socketCarlos = await connect(carlos.accessToken);
    sockets.push(socketCarlos);
    await waitFor(socketCarlos, 'connected');

    const purchased = waitFor<{ listId: string; item: any }>(socketCarlos, 'item:purchased');
    await request.post(`${API_URL}/items/${item.id}/purchase`, { headers: auth(ana.accessToken) });

    const evento = await purchased;
    expect(evento.listId).toBe(list.id);
    expect(evento.item.name).toBe('Leche entera');
    expect(evento.item.status).toBe('purchased');
  });

  test('CP-RT-004 · quien tiene los avisos activos recibe la notificación', async ({ request }) => {
    const ana = await registerUser(request, { fullName: 'Ana Avisos' });
    const carlos = await registerUser(request, { fullName: 'Carlos Avisos' });

    const list = await createList(request, ana.accessToken, 'Avisos en vivo');
    await shareList(request, ana.accessToken, list.id, carlos.email);

    const socketCarlos = await connect(carlos.accessToken);
    sockets.push(socketCarlos);
    await waitFor(socketCarlos, 'connected');

    const notification = waitFor<{ title: string; body: string; type: string }>(
      socketCarlos,
      'notification',
    );
    await createItem(request, ana.accessToken, list.id, { name: 'Manzanas' });

    const aviso = await notification;
    expect(aviso.type).toBe('item.added');
    expect(aviso.title).toBe('Avisos en vivo');
    expect(aviso.body).toContain('Ana Avisos');
    expect(aviso.body).toContain('Manzanas');
  });

  test('CP-RT-005 · quien desactiva los avisos no recibe notificación pero sí el cambio', async ({
    request,
  }) => {
    const ana = await registerUser(request, { fullName: 'Ana Silencio' });
    const carlos = await registerUser(request, { fullName: 'Carlos Silencio' });

    const list = await createList(request, ana.accessToken, 'Sin avisos');
    await shareList(request, ana.accessToken, list.id, carlos.email);

    await request.patch(`${API_URL}/lists/${list.id}/notifications`, {
      headers: auth(carlos.accessToken),
      data: { notifyOnChange: false },
    });

    const socketCarlos = await connect(carlos.accessToken);
    sockets.push(socketCarlos);
    await waitFor(socketCarlos, 'connected');

    let recibioAviso = false;
    socketCarlos.on('notification', () => {
      recibioAviso = true;
    });

    const created = waitFor<{ item: any }>(socketCarlos, 'item:created');
    await createItem(request, ana.accessToken, list.id, { name: 'Peras' });

    const evento = await created;
    expect(evento.item.name).toBe('Peras'); // la lista sí se sincroniza
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(recibioAviso, 'no debería recibir pop-up').toBe(false);
  });

  test('CP-RT-006 · quien hace el cambio no se auto-notifica', async ({ request }) => {
    const ana = await registerUser(request, { fullName: 'Ana Sola' });
    const carlos = await registerUser(request, { fullName: 'Carlos Testigo' });

    const list = await createList(request, ana.accessToken, 'Sin eco');
    await shareList(request, ana.accessToken, list.id, carlos.email);

    const socketAna = await connect(ana.accessToken);
    sockets.push(socketAna);
    await waitFor(socketAna, 'connected');

    let autoAviso = false;
    socketAna.on('notification', () => {
      autoAviso = true;
    });

    await createItem(request, ana.accessToken, list.id, { name: 'Uvas' });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(autoAviso).toBe(false);
  });

  test('CP-RT-007 · el aviso queda guardado para consultarlo después', async ({ request }) => {
    const ana = await registerUser(request, { fullName: 'Ana Historial' });
    const carlos = await registerUser(request, { fullName: 'Carlos Historial' });

    const list = await createList(request, ana.accessToken, 'Historial');
    await shareList(request, ana.accessToken, list.id, carlos.email);
    await createItem(request, ana.accessToken, list.id, { name: 'Chocolate' });

    await expect(async () => {
      const response = await request.get(`${API_URL}/notifications`, {
        headers: auth(carlos.accessToken),
      });
      const avisos = await response.json();
      expect(avisos.length).toBeGreaterThan(0);
      expect(avisos[0].body).toContain('Chocolate');
    }).toPass({ timeout: 10_000 });

    const contador = await request.get(`${API_URL}/notifications/unread-count`, {
      headers: auth(carlos.accessToken),
    });
    expect((await contador.json()).count).toBeGreaterThan(0);
  });
});
