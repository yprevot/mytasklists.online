import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { auth, API_URL, createItem, createList, registerUser, uniqueEmail, DEFAULT_PASSWORD } from '../../utils/api-helpers';
import { useSession, pendingItem, purchasedItem } from '../../utils/ui-helpers';
import { waitForEmail, linkFromEmail } from '../../utils/mailpit';

test('WEB-EDIT-IMG · editar pendiente y comprado, adjuntar y quitar imagen persiste al recargar', async ({ page, request }, info) => {
  const owner = await registerUser(request); const list = await createList(request, owner.accessToken, 'Edición visual');
  await createItem(request, owner.accessToken, list.id, { name: 'Leche', quantity: 2, unit: 'l' });
  await useSession(page, owner); await page.goto(`/app/lists/${list.id}`);
  await pendingItem(page, 'Leche').getByTestId('item-edit').click();
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Leche');
  await page.getByLabel('Nombre', { exact: true }).fill('Leche entera');
  await page.getByLabel('Cantidad', { exact: true }).fill('1,25');
  await page.getByLabel('Nota', { exact: true }).fill('Presentación grande');
  await page.getByLabel('Imagen del elemento').setInputFiles({ name: 'leche.png', mimeType: 'image/png', buffer: await sharp({ create: { width: 40, height: 30, channels: 3, background: '#f6c945' } }).png().toBuffer() });
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  const row = pendingItem(page, 'Leche entera'); await expect(row).toContainText('1.25 Litros');
  await expect(row.locator('img')).toBeVisible(); await expect.poll(() => row.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.reload(); await expect(pendingItem(page, 'Leche entera')).toContainText('Presentación grande');
  await pendingItem(page, 'Leche entera').getByTestId('item-checkbox').click();
  await purchasedItem(page, 'Leche entera').getByTestId('item-edit').click();
  await page.getByLabel('Nombre', { exact: true }).fill('Leche comprada');
  await page.getByRole('button', { name: 'Quitar imagen' }).click();
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(purchasedItem(page, 'Leche comprada')).toBeVisible();
  await expect(purchasedItem(page, 'Leche comprada').locator('img')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('edicion-desktop.png'), fullPage: true });
});

test('WEB-INV · enlace de invitación inicia registro y al terminar aparecen lista y membresía', async ({ page, request }) => {
  const owner = await registerUser(request); const list = await createList(request, owner.accessToken, 'Nueva persona invitada'); const email = uniqueEmail('registro-invitado');
  await request.post(`${API_URL}/lists/${list.id}/share`, { headers: auth(owner.accessToken), data: { email } });
  const invitation = await waitForEmail(request, email, 'te invitó');
  const url = invitation.text.match(/https?:\/\/\S+\/app\/register\?email=\S+/)![0];
  await page.goto(url); await expect(page.getByTestId('register-email')).toHaveValue(email);
  await page.getByTestId('register-submit').click(); await expect(page.getByTestId('registration-sent')).toBeVisible();
  const registration = await waitForEmail(request, email, 'Completa tu registro'); await page.goto(linkFromEmail(registration, '/app/register/complete'));
  await page.getByLabel('Nombre completo').fill('Persona Invitada'); await page.getByLabel(/WhatsApp/).fill('+525512345678');
  await page.getByLabel('Contraseña', { exact: true }).fill(DEFAULT_PASSWORD); await page.getByLabel(/Confirmar contraseña/).fill(DEFAULT_PASSWORD);
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page.getByTestId('lists-page')).toContainText('Nueva persona invitada');
});
