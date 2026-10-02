import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { API_URL, auth, createItem, createList, getList, registerUser, uniqueEmail } from '../../utils/api-helpers';
import { waitForEmail } from '../../utils/mailpit';

const photo = () => sharp({ create: { width: 32, height: 24, channels: 3, background: '#1d5b45' } }).png().toBuffer();

test('INV-01 · invitación por email, registro verificado y acceso inmediato con el rol enviado', async ({ request }) => {
  const owner = await registerUser(request);
  const list = await createList(request, owner.accessToken, 'Lista invitada');
  const email = uniqueEmail('invitada');
  const response = await request.post(`${API_URL}/lists/${list.id}/share`, { headers: auth(owner.accessToken), data: { email: email.toUpperCase(), role: 'editor' } });
  expect(response.status()).toBe(201);
  expect(await response.json()).toMatchObject({ invitationSent: true, invitationEmail: email, memberCount: 1 });
  const mail = await waitForEmail(request, email, 'te invitó');
  expect(mail.text).toContain(`/app/register?email=${encodeURIComponent(email)}`);
  const invited = await registerUser(request, { email });
  const detail = await getList(request, invited.accessToken, list.id);
  expect(detail.myRole).toBe('editor');
  expect(detail.memberCount).toBe(2);
  expect((await getList(request, owner.accessToken, list.id)).members.map((m: any) => m.email)).toContain(email);
  const visible = await request.get(`${API_URL}/lists`, { headers: auth(invited.accessToken) });
  expect((await visible.json()).map((l: any) => l.id)).toContain(list.id);
  await createItem(request, invited.accessToken, list.id, { name: 'Creado por invitada' });
  const duplicate = await request.post(`${API_URL}/lists/${list.id}/share`, { headers: auth(owner.accessToken), data: { email } });
  expect(duplicate.status()).toBe(400);
});

test('INV-02 · un invitado lector conserva sus permisos y nadie puede asignar propiedad por compartir', async ({ request }) => {
  const owner = await registerUser(request);
  const list = await createList(request, owner.accessToken, 'Solo consulta');
  const email = uniqueEmail('lectora');
  expect((await request.post(`${API_URL}/lists/${list.id}/share`, { headers: auth(owner.accessToken), data: { email, role: 'owner' } })).status()).toBe(400);
  expect((await request.post(`${API_URL}/lists/${list.id}/share`, { headers: auth(owner.accessToken), data: { userId: randomUUID() } })).status()).toBe(404);
  await request.post(`${API_URL}/lists/${list.id}/share`, { headers: auth(owner.accessToken), data: { email, role: 'viewer' } });
  const viewer = await registerUser(request, { email });
  expect((await getList(request, viewer.accessToken, list.id)).myRole).toBe('viewer');
  const item = await createItem(request, owner.accessToken, list.id, { name: 'Privado para lectura' });
  expect((await request.patch(`${API_URL}/items/${item.id}`, { headers: auth(viewer.accessToken), data: { name: 'No permitido' } })).status()).toBe(403);
  expect((await request.post(`${API_URL}/items/${item.id}/image`, { headers: auth(viewer.accessToken), multipart: { file: { name: 'photo.png', mimeType: 'image/png', buffer: await photo() } } })).status()).toBe(403);
});

test('EDIT-01 · editar comprado conserva su estado y actualiza cantidad, unidad, nota y recurrencia', async ({ request }) => {
  const owner = await registerUser(request); const list = await createList(request, owner.accessToken, 'Editar comprado');
  const item = await createItem(request, owner.accessToken, list.id, { name: 'Arroz', isRecurring: true, recurrenceDays: 14 });
  await request.post(`${API_URL}/items/${item.id}/purchase`, { headers: auth(owner.accessToken) });
  const response = await request.patch(`${API_URL}/items/${item.id}`, { headers: auth(owner.accessToken), data: { name: 'Arroz integral', quantity: 1.25, unit: 'kg', note: 'Marca preferida', recurrenceDays: 7 } });
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ name: 'Arroz integral', status: 'purchased', quantity: 1.25, unit: 'kg', note: 'Marca preferida', recurrenceDays: 7 });
  expect((await getList(request, owner.accessToken, list.id)).purchased[0].name).toBe('Arroz integral');
  for (const data of [{ quantity: 1.111 }, { quantity: 0 }, { recurrenceDays: 366 }]) expect((await request.patch(`${API_URL}/items/${item.id}`, { headers: auth(owner.accessToken), data })).status()).toBe(400);
});

test('IMG-01 · subir, reemplazar y borrar imagen elimina los archivos anteriores y exige membresía', async ({ request }) => {
  const owner = await registerUser(request); const stranger = await registerUser(request);
  const list = await createList(request, owner.accessToken, 'Imágenes'); const item = await createItem(request, owner.accessToken, list.id, { name: 'Fruta' });
  const multipart = { file: { name: 'photo.png', mimeType: 'image/png', buffer: await photo() } };
  expect((await request.post(`${API_URL}/items/${item.id}/image`, { headers: auth(stranger.accessToken), multipart })).status()).toBe(404);
  const first = await request.post(`${API_URL}/items/${item.id}/image`, { headers: auth(owner.accessToken), multipart });
  expect(first.status()).toBe(201); const image1 = (await first.json()).imageUrl;
  const downloaded = await request.get(`${API_URL}${image1}`); expect(downloaded.status()).toBe(200); expect(downloaded.headers()['content-type']).toContain('image/jpeg');
  expect((await sharp(await downloaded.body()).metadata()).width).toBe(32);
  expect((await getList(request, owner.accessToken, list.id)).pending[0].imageUrl).toBe(image1);
  const second = await request.post(`${API_URL}/items/${item.id}/image`, { headers: auth(owner.accessToken), multipart }); const image2 = (await second.json()).imageUrl;
  expect(image2).not.toBe(image1); expect((await request.get(`${API_URL}${image1}`)).status()).toBe(404);
  expect((await request.delete(`${API_URL}/items/${item.id}/image`, { headers: auth(owner.accessToken) })).status()).toBe(200);
  expect((await request.get(`${API_URL}${image2}`)).status()).toBe(404);
  const third = await request.post(`${API_URL}/items/${item.id}/image`, { headers: auth(owner.accessToken), multipart }); const image3 = (await third.json()).imageUrl;
  await request.delete(`${API_URL}/lists/${list.id}`, { headers: auth(owner.accessToken) });
  expect((await request.get(`${API_URL}${image3}`)).status()).toBe(404);
});

test('IMG-02 · rechaza formatos falsificados, imágenes dañadas y archivos mayores a 5 MB', async ({ request }) => {
  const owner = await registerUser(request); const list = await createList(request, owner.accessToken, 'Validación imagen'); const item = await createItem(request, owner.accessToken, list.id, { name: 'Producto' });
  for (const file of [
    { name: 'x.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg></svg>') },
    { name: 'x.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([255, 216, 255, 0, 1]) },
    { name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('not an image') },
  ]) expect((await request.post(`${API_URL}/items/${item.id}/image`, { headers: auth(owner.accessToken), multipart: { file } })).status()).toBe(415);
  const oversized = await request.post(`${API_URL}/items/${item.id}/image`, { headers: auth(owner.accessToken), multipart: { file: { name: 'large.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 255) } } });
  expect(oversized.status()).toBe(413);
  expect((await getList(request, owner.accessToken, list.id)).pending[0].imageUrl).toBeNull();
});

test('IMG-03 · foto y edición simultáneas conservan ambos cambios', async ({ request }) => {
  const owner = await registerUser(request); const list = await createList(request, owner.accessToken, 'Edición simultánea'); const item = await createItem(request, owner.accessToken, list.id, { name: 'Original' });
  const bytes = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#f6c945' } }).png().toBuffer();
  const [upload, edit] = await Promise.all([
    request.post(`${API_URL}/items/${item.id}/image`, { headers: auth(owner.accessToken), multipart: { file: { name: 'photo.png', mimeType: 'image/png', buffer: bytes } } }),
    request.patch(`${API_URL}/items/${item.id}`, { headers: auth(owner.accessToken), data: { name: 'Nombre editado', quantity: 2.5 } }),
  ]);
  expect(upload.status()).toBe(201); expect(edit.status()).toBe(200);
  const final = (await getList(request, owner.accessToken, list.id)).pending[0];
  expect(final).toMatchObject({ name: 'Nombre editado', quantity: 2.5 }); expect(final.imageUrl).toMatch(/\.jpg$/);
  const image = await request.get(`${API_URL}${final.imageUrl}`); expect(image.status()).toBe(200); expect((await sharp(await image.body()).metadata()).width).toBe(1600);
});
