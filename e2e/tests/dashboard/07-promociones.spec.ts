import {test,expect} from '@playwright/test';
import {SEED} from '../../utils/api-helpers';
test('PRO-ADM · promociones se administran desde una sección dedicada',async({page})=>{
 await page.goto('/dashboard/login');await page.getByTestId('login-email').fill(SEED.admin.email);await page.getByTestId('login-password').fill(SEED.admin.password);await page.getByTestId('login-submit').click();await expect(page.getByTestId('overview-page')).toBeVisible();await page.goto('/dashboard/promotions');await expect(page.getByRole('heading',{name:'Códigos promocionales'})).toBeVisible();await expect(page.getByLabel('Código',{exact:true})).toBeVisible();
});
