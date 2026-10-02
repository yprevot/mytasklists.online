import { expect, test } from '@playwright/test';
import { createItem, createList, registerUser } from '../../utils/api-helpers';

test('MOV-EDIT · editor carga datos, guarda cambios y puede reabrirse en otro item y en comprados', async ({ page, request }, info) => {
  const owner = await registerUser(request); const list = await createList(request, owner.accessToken, 'Editor móvil');
  await createItem(request, owner.accessToken, list.id, { name: 'Leche', quantity: 2, unit: 'l', note: 'Sin lactosa' });
  await createItem(request, owner.accessToken, list.id, { name: 'Pan', quantity: 3, unit: 'pza' });
  await page.goto('/'); await page.getByTestId('login-email').fill(owner.email); await page.getByTestId('login-password').fill(owner.password); await page.getByTestId('login-submit').click();
  await page.getByTestId('list-card').filter({ hasText: 'Editor móvil' }).click();
  await page.getByRole('button', { name: 'Editar: Leche', exact: true }).click();
  await expect(page.getByTestId('edit-item-name')).toHaveValue('Leche');
  await expect(page.getByTestId('edit-item-quantity')).toHaveValue('2');
  await expect(page.getByLabel('Nota', { exact: true })).toHaveValue('Sin lactosa');
  await page.getByTestId('edit-item-name').fill('Leche editada'); await page.getByTestId('edit-item-quantity').fill('1,5');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  const row = page.getByTestId('pending-item').filter({ hasText: 'Leche editada' }); await expect(row).toContainText('1.5 Litros');
  await page.getByRole('button', { name: 'Editar: Pan', exact: true }).click(); await expect(page.getByTestId('edit-item-name')).toHaveValue('Pan'); await expect(page.getByTestId('edit-item-quantity')).toHaveValue('3');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await row.getByTestId('item-checkbox').click();
  await page.getByRole('button', { name: 'Editar: Leche editada', exact: true }).click(); await expect(page.getByTestId('edit-item-name')).toHaveValue('Leche editada');
  await page.getByTestId('edit-item-name').fill('Leche comprada'); await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByTestId('purchased-item').filter({ hasText: 'Leche comprada' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('edicion-movil.png'), fullPage: true });
});

test('MOV-IMG · galería y edición suben una imagen real que se muestra en la lista', async ({ page, request }) => {
  const { default: sharp } = await import('sharp');
  const owner = await registerUser(request); const list = await createList(request, owner.accessToken, 'Foto móvil');
  await createItem(request, owner.accessToken, list.id, { name: 'Producto con foto' });
  await page.goto('/'); await page.getByTestId('login-email').fill(owner.email); await page.getByTestId('login-password').fill(owner.password); await page.getByTestId('login-submit').click();
  await page.getByTestId('list-card').filter({ hasText: 'Foto móvil' }).click(); await page.getByRole('button', { name: 'Editar: Producto con foto', exact: true }).click();
  const chooser = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Elegir foto', exact: true }).last().click();
  await (await chooser).setFiles({ name: 'photo.png', mimeType: 'image/png', buffer: await sharp({ create: { width: 30, height: 20, channels: 3, background: '#f6c945' } }).png().toBuffer() });
  await expect(page.getByText('Quitar foto', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  const row = page.getByTestId('pending-item').filter({ hasText: 'Producto con foto' });
  await expect(row.locator('img')).toBeVisible(); await expect.poll(() => row.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});
