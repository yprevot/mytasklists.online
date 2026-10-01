import {useSession,pendingItem,purchasedItem} from '../../utils/ui-helpers';
import {test,expect} from '@playwright/test';
import {registerUser,createList,uniqueEmail,DEFAULT_PASSWORD} from '../../utils/api-helpers';
import {requestRegistration} from '../../utils/registration';
test('REG-18/20 · enlace limpia URL, correo fijo y confirma contraseña',async({page,request})=>{
 const email=uniqueEmail('confirmacion');const {link}=await requestRegistration(request,email);await page.goto(link);
 await expect(page.getByLabel('Correo electrónico')).toHaveValue(email);await expect(page).not.toHaveURL(/token=/);
 await page.getByLabel('Nombre completo').fill('Persona de Prueba');await page.getByLabel(/WhatsApp/).fill('+525512345678');
 await page.getByLabel('Contraseña',{exact:true}).fill(DEFAULT_PASSWORD);await page.getByLabel(/Confirmar contraseña/).fill('OtraClave123!');
 await page.getByRole('button',{name:'Crear cuenta',exact:true}).click();await expect(page.getByText(/contraseñas no coinciden/i)).toBeVisible();
});
test('PAY-01 · Mi plan permite seguir gratis cuando los cobros no están configurados',async({page,request})=>{
 const user=await registerUser(request);await page.goto('/app/login');await page.getByLabel('Correo electrónico').fill(user.email);await page.getByLabel('Contraseña',{exact:true}).fill(DEFAULT_PASSWORD);await page.getByTestId('login-submit').click();await expect(page).toHaveURL(/\/app\/?$/);await page.goto('/app/billing');
 await expect(page.getByText(/5 USD/).first()).toBeVisible();await expect(page.getByText(/próximamente/i).first()).toBeVisible();await expect(page.getByRole('button',{name:/Continuar al pago/i})).toHaveCount(0);
});

test('UNI-01/03/05 · personalizado y cantidad decimal permanecen después de comprar',async({page,request})=>{
 const user=await registerUser(request);const list=await createList(request,user.accessToken,'Unidades propias');await useSession(page,user);await page.goto(`/app/lists/${list.id}`);
 await page.getByTestId('toggle-item-options').click();await expect(page.getByTestId('item-unit-input')).toHaveValue('pza');
 await page.getByTestId('item-name-input').fill('Café especial');await page.getByTestId('item-unit-input').selectOption('custom');await page.getByTestId('item-custom-unit').fill(' bolsas ');await page.getByTestId('item-quantity-input').fill('1,25');await page.getByTestId('add-item-button').click();
 await expect(pendingItem(page,'Café especial').getByTestId('item-quantity')).toHaveText('1.25 bolsas');await pendingItem(page,'Café especial').getByTestId('item-checkbox').click();await expect(purchasedItem(page,'Café especial')).toContainText('1.25 bolsas');await page.reload();await expect(purchasedItem(page,'Café especial')).toContainText('1.25 bolsas');
});

test('PAY-REG · elegir Premium antes de ingresar conserva el destino de suscripción',async({page,request})=>{
 const user=await registerUser(request);await page.goto('/app/billing');await page.getByRole('link',{name:'Ingresar',exact:true}).click();await page.getByTestId('login-email').fill(user.email);await page.getByTestId('login-password').fill(user.password);await page.getByTestId('login-submit').click();await expect(page).toHaveURL(/\/app\/billing/);await expect(page.getByTestId('billing-page')).toBeVisible();
});
