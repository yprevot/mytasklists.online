import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { createItem, createList, registerUser, shareList } from '../../utils/api-helpers';
import { pendingItem, purchasedItem, useSession, waitForRealtime } from '../../utils/ui-helpers';

/**
 * Casos con dos personas usando la misma lista al mismo tiempo.
 * Se graba una ventana por persona (…-ventana1.webm y …-ventana2.webm).
 */
test.describe('Frontend web · listas compartidas en tiempo real', () => {
  let extraContext: BrowserContext | null = null;
  let extraPage: Page | null = null;

  // La segunda ventana se graba aparte y se adjunta como evidencia "ventana2"
  test.afterEach(async ({}, testInfo) => {
    if (!extraContext) return;
    const video = extraPage?.video();
    await extraContext.close();
    const path = await video?.path().catch(() => undefined);
    if (path) {
      await testInfo.attach('video', { path, contentType: 'video/webm' });
    }
    extraContext = null;
    extraPage = null;
  });

  const openSecondWindow = async (
    browser: any,
    testInfo: any,
    tokens: { accessToken: string; refreshToken: string },
  ): Promise<Page> => {
    extraContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'es-MX',
      recordVideo: { dir: testInfo.outputDir, size: { width: 1280, height: 800 } },
    });
    extraPage = await extraContext!.newPage();
    await useSession(extraPage, tokens);
    return extraPage;
  };

  test('CP-WEB-026 · compartir una lista desde la interfaz', async ({ page, request }) => {
    const ana = await registerUser(request, { fullName: 'Ana Propietaria' });
    const carlos = await registerUser(request, { fullName: 'Carlos Invitado' });
    const list = await createList(request, ana.accessToken, 'Super compartido');

    await useSession(page, ana);
    await page.goto(`/app/lists/${list.id}`);

    await page.getByTestId('share-button').click();
    await expect(page.getByTestId('share-modal')).toBeVisible();
    await page.getByTestId('share-email-input').fill(carlos.email);
    await page.getByTestId('share-submit').click();

    await expect(page.getByTestId('member-list')).toContainText(carlos.email);
    await expect(page.getByTestId('member-row')).toHaveCount(2);

    await page.getByTestId('share-modal-close').click();
    await expect(page.getByTestId('list-members-badge')).toContainText('2 integrantes');
  });

  test('CP-WEB-027 · envía invitación a alguien sin cuenta', async ({
    page,
    request,
  }) => {
    const ana = await registerUser(request, { fullName: 'Ana Sola' });
    const list = await createList(request, ana.accessToken, 'Sin destinatario');

    await useSession(page, ana);
    await page.goto(`/app/lists/${list.id}`);
    await page.getByTestId('share-button').click();
    await page.getByTestId('share-email-input').fill('nadie.registrado@example.com');
    await page.getByTestId('share-submit').click();

    await expect(page.getByText(/el enlace para crear una cuenta y unirse a la lista/i)).toBeVisible();
    await expect(page.getByTestId('share-email-input')).toHaveValue('');
  });

  test('CP-WEB-028 · lo que una persona marca se actualiza al instante en la otra', async ({
    page,
    browser,
    request,
  }, testInfo) => {
    const ana = await registerUser(request, { fullName: 'Ana Super' });
    const carlos = await registerUser(request, { fullName: 'Carlos Super' });
    const list = await createList(request, ana.accessToken, 'Super en pareja');
    await shareList(request, ana.accessToken, list.id, carlos.email);
    await createItem(request, ana.accessToken, list.id, { name: 'Leche entera' });

    // Ventana 1: Ana
    await useSession(page, ana);
    await page.goto(`/app/lists/${list.id}`);
    await waitForRealtime(page);
    await expect(pendingItem(page, 'Leche entera')).toBeVisible();

    // Ventana 2: Carlos
    const paginaCarlos = await openSecondWindow(browser, testInfo, carlos);
    await paginaCarlos.goto(`/app/lists/${list.id}`);
    await waitForRealtime(paginaCarlos);
    await expect(pendingItem(paginaCarlos, 'Leche entera')).toBeVisible();

    // Carlos marca el producto en el super…
    await pendingItem(paginaCarlos, 'Leche entera').getByTestId('item-checkbox').click();
    await expect(purchasedItem(paginaCarlos, 'Leche entera')).toBeVisible();

    // …y la lista de Ana se actualiza sola, sin recargar
    await expect(purchasedItem(page, 'Leche entera')).toBeVisible({ timeout: 15_000 });
    await expect(pendingItem(page, 'Leche entera')).toHaveCount(0);
  });

  test('CP-WEB-029 · la otra persona recibe un pop-up con el aviso', async ({
    page,
    browser,
    request,
  }, testInfo) => {
    const ana = await registerUser(request, { fullName: 'Ana Avisadora' });
    const carlos = await registerUser(request, { fullName: 'Carlos Avisado' });
    const list = await createList(request, ana.accessToken, 'Avisos en vivo');
    await shareList(request, ana.accessToken, list.id, carlos.email);

    await useSession(page, ana);
    await page.goto(`/app/lists/${list.id}`);
    await waitForRealtime(page);

    const paginaCarlos = await openSecondWindow(browser, testInfo, carlos);
    await paginaCarlos.goto(`/app/lists/${list.id}`);
    await waitForRealtime(paginaCarlos);

    // Ana agrega un producto
    await page.getByTestId('item-name-input').fill('Manzanas');
    await page.getByTestId('add-item-button').click();

    // Carlos ve el pop-up y el producto
    const toast = paginaCarlos.getByTestId('toast').first();
    await expect(toast).toBeVisible({ timeout: 15_000 });
    await expect(toast.getByTestId('toast-title')).toHaveText('Avisos en vivo');
    await expect(toast.getByTestId('toast-body')).toContainText('Ana Avisadora');
    await expect(toast.getByTestId('toast-body')).toContainText('Manzanas');
    await expect(paginaCarlos.getByTestId('notification-count')).toBeVisible();
    await expect(pendingItem(paginaCarlos, 'Manzanas')).toBeVisible();
  });

  test('CP-WEB-030 · quien apaga "Avisarme" deja de recibir pop-ups', async ({
    page,
    browser,
    request,
  }, testInfo) => {
    const ana = await registerUser(request, { fullName: 'Ana Silenciosa' });
    const carlos = await registerUser(request, { fullName: 'Carlos Silencioso' });
    const list = await createList(request, ana.accessToken, 'Sin avisos');
    await shareList(request, ana.accessToken, list.id, carlos.email);

    const paginaCarlos = await openSecondWindow(browser, testInfo, carlos);
    await paginaCarlos.goto(`/app/lists/${list.id}`);
    await waitForRealtime(paginaCarlos);

    // Carlos apaga sus avisos para esta lista
    await paginaCarlos.getByTestId('notify-switch').click();
    await expect(paginaCarlos.getByTestId('notify-switch')).not.toBeChecked();

    await useSession(page, ana);
    await page.goto(`/app/lists/${list.id}`);
    await waitForRealtime(page);
    await page.getByTestId('item-name-input').fill('Peras');
    await page.getByTestId('add-item-button').click();

    // El producto llega a su lista, pero sin pop-up
    await expect(pendingItem(paginaCarlos, 'Peras')).toBeVisible({ timeout: 15_000 });
    await expect(paginaCarlos.getByTestId('toast')).toHaveCount(0);
  });
});
