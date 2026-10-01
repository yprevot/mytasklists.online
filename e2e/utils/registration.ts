import type { APIRequestContext } from '@playwright/test';
import { API_URL } from './api-helpers';
import { waitForEmail,tokenFromEmail,linkFromEmail } from './mailpit';
export async function requestRegistration(request:APIRequestContext,email:string,locale:'es'|'en'='es'){
 const response=await request.post(`${API_URL}/auth/registration/request`,{headers:{'Accept-Language':locale},data:{email}});
 if(!response.ok())throw new Error(`Registration request failed: ${response.status()}`);
 const mail=await waitForEmail(request,email,locale==='en'?'Complete your registration':'Completa tu registro');
 return {token:tokenFromEmail(mail,'/app/register/complete'),link:linkFromEmail(mail,'/app/register/complete')};
}
