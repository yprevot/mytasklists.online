import {expect,test} from '@playwright/test';
import {API_URL,uniqueEmail,uniqueWhatsapp,DEFAULT_PASSWORD,registerUser,auth,createList,createItem} from '../../utils/api-helpers';
import {requestRegistration} from '../../utils/registration';
const fields=()=>({fullName:'Persona Verificada',whatsapp:uniqueWhatsapp(),password:DEFAULT_PASSWORD,passwordConfirmation:DEFAULT_PASSWORD});
test('REG-01/06/07/11/19 · correo primero, enlace no consume y alta una sola vez',async({request})=>{
 const email=uniqueEmail('flow');const {token}=await requestRegistration(request,email);
 expect((await request.post(`${API_URL}/auth/login`,{data:{email,password:DEFAULT_PASSWORD}})).status()).toBe(401);
 for(let i=0;i<2;i++){const r=await request.post(`${API_URL}/auth/registration/validate`,{data:{token}});expect(r.status()).toBe(200);expect((await r.json()).email).toBe(email);}
 const complete=await request.post(`${API_URL}/auth/registration/complete`,{data:{...fields(),token,email:'intruder@example.com'}});expect(complete.status()).toBe(201);
 const body=await complete.json();expect(body.user.email).toBe(email);expect(body.user.emailVerified).toBe(true);
 expect((await request.post(`${API_URL}/auth/registration/complete`,{data:{...fields(),token}})).status()).toBe(400);
});
test('REG-04 · correo existente no genera enlace de alta',async({request})=>{
 const r=await request.post(`${API_URL}/auth/registration/request`,{data:{email:'ana@example.com'}});expect(r.status()).toBe(200);expect(await r.json()).toEqual({ok:true,cooldownSeconds:60});
 const mail=await request.get('http://localhost:8025/api/v1/search',{params:{query:'to:"ana@example.com" subject:"Completa tu registro"'}});expect((await mail.json()).messages.length).toBe(0);
});
for(const email of ['', 'bad-address','a'.repeat(180)+'@example.com'])test(`REG-03 · correo inválido ${email.slice(0,8)}`,async({request})=>{expect((await request.post(`${API_URL}/auth/registration/request`,{data:{email}})).status()).toBe(400);});
for(const token of ['', 'broken', 'A'.repeat(43)])test(`REG-09 · token inválido ${token.slice(0,8)}`,async({request})=>{expect((await request.post(`${API_URL}/auth/registration/validate`,{data:{token}})).status()).toBe(400);});
test('REG-15/16 · confirmación requerida y enlace corregible',async({request})=>{const {token}=await requestRegistration(request,uniqueEmail());const payload={...fields(),token};
 expect((await request.post(`${API_URL}/auth/registration/complete`,{data:{...payload,passwordConfirmation:'different'}})).status()).toBe(400);
 expect((await request.post(`${API_URL}/auth/registration/validate`,{data:{token}})).status()).toBe(200);
 expect((await request.post(`${API_URL}/auth/registration/complete`,{data:payload})).status()).toBe(201);
});
test('REG-14 · bcrypt rechaza truncamiento de Unicode',async({request})=>{const {token}=await requestRegistration(request,uniqueEmail());expect((await request.post(`${API_URL}/auth/registration/complete`,{data:{...fields(),token,password:'é'.repeat(40),passwordConfirmation:'é'.repeat(40)}})).status()).toBe(400);});
test('REG-20 · dos altas simultáneas crean solo una cuenta',async({request})=>{const {token}=await requestRegistration(request,uniqueEmail());const data={...fields(),token};const rs=await Promise.all([request.post(`${API_URL}/auth/registration/complete`,{data}),request.post(`${API_URL}/auth/registration/complete`,{data})]);expect(rs.map(r=>r.status()).sort()).toEqual([201,400]);});
test('REG-23 · reenvío inmediato limitado',async({request})=>{const email=uniqueEmail();await requestRegistration(request,email);expect((await request.post(`${API_URL}/auth/registration/request`,{data:{email}})).status()).toBe(429);});
test('PAY-02/07/PRO-14 · estado Gratis, no acceso por cliente y admin protegido',async({request})=>{const user=await registerUser(request);const headers=auth(user.accessToken);const me=await request.get(`${API_URL}/billing/me`,{headers});expect((await me.json()).plan).toBe('free');
 expect((await request.post(`${API_URL}/billing/checkout`,{headers,data:{expectedTotal:1,plan:'premium'}})).status()).toBe(503);
 expect((await request.get(`${API_URL}/billing/admin/promotions`,{headers})).status()).toBe(403);
 expect((await request.post(`${API_URL}/billing/webhook/stripe`,{data:{id:'fake'}})).status()).toBeGreaterThanOrEqual(400);
});
test('DES-01 · tiendas no publicadas y sin artefactos ficticios',async({request})=>{const r=await request.get(`${API_URL}/distribution`);expect(r.status()).toBe(200);expect(await r.json()).toEqual({android:{storeUrl:null,apk:null},ios:{storeUrl:null,testflightUrl:null}});});
test('UNI-02/03/04/06 · unidades y cantidades persisten sin alterar recurrencia',async({request})=>{const user=await registerUser(request);const list=await createList(request,user.accessToken,'Unidades');
 for(const unit of ['pza','lb','kg','g','l','ml','oz','bolsas']){const item=await createItem(request,user.accessToken,list.id,{name:'Producto '+unit,unit,quantity:1.5,isRecurring:true,recurrenceDays:3});expect(item.unit).toBe(unit);expect(item.quantity).toBe(1.5);const purchased=await request.post(`${API_URL}/items/${item.id}/purchase`,{headers:auth(user.accessToken)});expect((await purchased.json()).unit).toBe(unit);}
 for(const payload of [{quantity:0},{quantity:-1},{quantity:1.111},{unit:' '},{unit:'x'.repeat(21)}]){const r=await request.post(`${API_URL}/lists/${list.id}/items`,{headers:auth(user.accessToken),data:{name:'Inválido',...payload}});expect(r.status()).toBe(400);}
});
