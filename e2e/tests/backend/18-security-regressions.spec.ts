import { test, expect, request as playwrightRequest } from '@playwright/test';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { io } from 'socket.io-client';
import { registerUser, createList, createItem, auth, API_URL, DEFAULT_PASSWORD, uniqueEmail, getList } from '../../utils/api-helpers';

const photo = async () => ({ file: { name: 'private.png', mimeType: 'image/png', buffer:
  await sharp({create:{width:16,height:12,channels:3,background:'#1d5b45'}}).png().toBuffer() } });
const backend = (script: string, ...args: string[]) => execFileSync('docker', ['compose','exec','-T','backend','node','-e',script,...args], {cwd:'..',encoding:'utf8'});

test('SEC-01 fotos requieren permiso temporal; revocación inmediata y aislamiento entre sesiones', async ({request}) => {
  const owner=await registerUser(request), reader=await registerUser(request);
  const list=await createList(request,owner.accessToken,'Privacidad');
  await request.post(`${API_URL}/lists/${list.id}/share`, {headers:auth(owner.accessToken),data:{email:reader.email,role:'viewer'}});
  const item=await createItem(request,owner.accessToken,list.id,{name:'Privada'});
  const upload=await request.post(`${API_URL}/items/${item.id}/image`, {headers:auth(owner.accessToken),multipart:await photo()});
  expect(upload.status()).toBe(201);
  const ownerUrl=(await upload.json()).imageUrl;
  const readerUrl=(await getList(request,reader.accessToken,list.id)).pending[0].imageUrl;
  expect(readerUrl).not.toBe(ownerUrl);
  expect((await request.get(API_URL+ownerUrl.split('?')[0])).status()).toBe(401);
  const permitted=await request.get(API_URL+readerUrl);
  expect(permitted.status()).toBe(200); expect(permitted.headers()['cache-control']).toBe('private, no-store');
  await request.delete(`${API_URL}/lists/${list.id}/members/${reader.id}`,{headers:auth(owner.accessToken)});
  expect((await request.get(API_URL+readerUrl)).status()).toBe(404);
  expect((await request.get(API_URL+ownerUrl)).status()).toBe(200);
  expect((await request.get(API_URL+ownerUrl.replace(/grant=./,'grant=x'))).status()).toBe(401);
  await request.delete(`${API_URL}/lists/${list.id}`, {headers:auth(owner.accessToken)});
  expect((await request.get(API_URL+ownerUrl)).status()).toBe(404);
});

test('SEC-01 borrar cuenta registra y ejecuta limpieza durable de fotos', async ({request}) => {
  const owner=await registerUser(request), list=await createList(request,owner.accessToken,'Borrado');
  const item=await createItem(request,owner.accessToken,list.id,{name:'Foto'});
  const upload=await request.post(`${API_URL}/items/${item.id}/image`,{headers:auth(owner.accessToken),multipart:await photo()});
  const url=(await upload.json()).imageUrl, key=url.split('?')[0].split('/').pop();
  expect((await request.delete(`${API_URL}/users/me`,{headers:auth(owner.accessToken),data:{password:DEFAULT_PASSWORD}})).status()).toBe(200);
  expect((await request.get(API_URL+url)).status()).toBe(401);
  await expect.poll(() => backend("const fs=require('fs');process.stdout.write(String(fs.existsSync(process.env.ITEM_IMAGE_DIR+'/'+process.argv[1])))",key),{timeout:15000}).toBe('false');
});

test('DOM-01 solo propietario canónico; no se puede asignar owner mediante roles', async ({request}) => {
  const owner=await registerUser(request), reader=await registerUser(request), list=await createList(request,owner.accessToken,'Propiedad');
  await request.post(`${API_URL}/lists/${list.id}/share`,{headers:auth(owner.accessToken),data:{email:reader.email,role:'viewer'}});
  expect((await request.patch(`${API_URL}/lists/${list.id}/members/${reader.id}`,{headers:auth(owner.accessToken),data:{role:'owner'}})).status()).toBe(400);
  expect((await getList(request,owner.accessToken,list.id)).members.filter((m:any)=>m.role==='owner')).toHaveLength(1);
  expect((await request.delete(`${API_URL}/lists/${list.id}`,{headers:auth(reader.accessToken)})).status()).toBe(403);
  await request.delete(`${API_URL}/lists/${list.id}`,{headers:auth(owner.accessToken)});
});

test('SEC-03 cooldown sobrevive cancelación; invitación cancelada no se acepta al registrarse', async ({request}) => {
  const owner=await registerUser(request), list=await createList(request,owner.accessToken,'Invitaciones'), email=uniqueEmail('canceled');
  const send=()=>request.post(`${API_URL}/lists/${list.id}/share`,{headers:auth(owner.accessToken),data:{email}});
  expect((await send()).status()).toBe(201); expect((await send()).status()).toBe(429);
  const pending=await request.get(`${API_URL}/lists/${list.id}/invitations`,{headers:auth(owner.accessToken)});
  expect(pending.status()).toBe(200);
  const [invite]=await pending.json(); expect(invite.email).toBe(email); expect(invite.token).toBeUndefined();
  expect((await request.delete(`${API_URL}/lists/${list.id}/invitations/${invite.id}`,{headers:auth(owner.accessToken)})).status()).toBe(200);
  expect((await send()).status()).toBe(429);
  const recipient=await registerUser(request,{email});
  expect((await request.get(`${API_URL}/lists/${list.id}`,{headers:auth(recipient.accessToken)})).status()).toBe(404);
  expect((await request.get(`${API_URL}/lists/${list.id}/invitations`,{headers:auth(recipient.accessToken)})).status()).toBe(404);
  await request.delete(`${API_URL}/lists/${list.id}`,{headers:auth(owner.accessToken)});
});

test('SEC-04 socket expira; no recibe eventos después de exp ni acepta reconexión con el mismo JWT', async ({request}) => {
  const owner=await registerUser(request), list=await createList(request,owner.accessToken,'Socket');
  const token=backend("const jwt=require('jsonwebtoken');process.stdout.write(jwt.sign({sub:process.argv[1],email:'qa@example.invalid',role:'user',type:'access',sv:0},process.env.JWT_ACCESS_SECRET,{expiresIn:3}))",owner.id);
  const socket=io(API_URL.replace(/\/api$/,''),{transports:['websocket'],auth:{token},reconnection:false});
  try {
    await new Promise<void>((resolve,reject)=>{socket.once('connected',()=>resolve());socket.once('connect_error',reject)});
    let received=false; socket.on('item:created',()=>{received=true});
    await expect.poll(()=>socket.connected,{timeout:6000}).toBe(false);
    expect((await request.get(`${API_URL}/lists`,{headers:auth(token)})).status()).toBe(401);
    await createItem(request,owner.accessToken,list.id,{name:'Tras expirar'}); expect(received).toBe(false);
    const error=new Promise<string>(resolve=>socket.once('connect_error',e=>resolve(e.message))); socket.connect();
    expect(await error).toMatch(/expirado/);
  } finally {socket.disconnect();await request.delete(`${API_URL}/lists/${list.id}`,{headers:auth(owner.accessToken)})}
});

test('SEC-02 rol de aplicación permite datos y rechaza cambios de esquema y roles', async () => {
  const result=backend(`(async()=>{
    const {spawnSync}=require('child_process'),{randomBytes}=require('crypto'),{Client}=require('pg');
    const password=randomBytes(32).toString('hex'),user='mytasklists_runtime_qa';
    const migrated=spawnSync(process.execPath,['dist/database/run-migrations.js'],{env:{...process.env,APP_DB_USER:user,APP_DB_PASSWORD:password},encoding:'utf8'});
    if(migrated.status!==0)throw new Error('migration failed');
    const c=new Client({host:process.env.POSTGRES_HOST,port:5432,database:process.env.POSTGRES_DB,user,password});await c.connect();
    const flags=(await c.query('SELECT rolsuper,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=current_user')).rows[0];
    await c.query('SELECT id FROM users LIMIT 1');
    const denied=[];for(const sql of ['CREATE TABLE security_forbidden(id int)','CREATE ROLE security_forbidden','SELECT * FROM migrations']) {
      try {await c.query(sql);denied.push(false)}catch(e){denied.push(e.code==='42501')}
    }
    await c.end();process.stdout.write(JSON.stringify({flags,denied}));
  })().catch(()=>process.exit(1))`);
  expect(JSON.parse(result)).toEqual({flags:{rolsuper:false,rolcreaterole:false,rolcreatedb:false},denied:[true,true,true]});
});

test('ARC-01 SMTP caído conserva el correo cifrado y no retiene una transacción de registro', async ({request}) => {
  const email=uniqueEmail('outbox');
  execFileSync('docker',['compose','stop','mailpit'],{cwd:'..',stdio:'pipe'});
  try {
    expect((await request.post(`${API_URL}/auth/registration/request`,{data:{email}})).status()).toBe(200);
    const result=backend(`(async()=>{const {Client}=require('pg');const c=new Client({host:process.env.POSTGRES_HOST,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD,database:process.env.POSTGRES_DB});await c.connect();
      const jobs=(await c.query('SELECT payload FROM mail_outbox WHERE reference=$1',[process.argv[1]])).rows;
      const locks=(await c.query("SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory' AND granted")).rows[0].n;
      await c.end();process.stdout.write(JSON.stringify({jobs:jobs.length,encrypted:jobs.every(j=>j.payload.startsWith('v1.')&&!j.payload.includes(process.argv[1])),locks}));})().catch(()=>process.exit(1))`,email);
    expect(JSON.parse(result)).toMatchObject({jobs:1,encrypted:true,locks:0});
  } finally { execFileSync('docker',['compose','start','mailpit'],{cwd:'..',stdio:'pipe'}); }
  const {waitForEmail,MAILPIT_URL}=await import('../../utils/mailpit');
  const fresh=await playwrightRequest.newContext();
  try {
    await expect.poll(async()=>{
      try { return (await fresh.get(`${MAILPIT_URL}/api/v1/info`)).status(); } catch { return 0; }
    },{timeout:15_000}).toBe(200);
    await waitForEmail(fresh,email,'Completa tu registro');
  } finally { await fresh.dispose(); }
});

test('ARC-01 cuota de fotos conserva el archivo anterior y limita la concurrencia de trabajo', async ({request}) => {
  const owner=await registerUser(request), list=await createList(request,owner.accessToken,'Cuota');
  const first=await createItem(request,owner.accessToken,list.id,{name:'Primero'}), second=await createItem(request,owner.accessToken,list.id,{name:'Segundo'});
  const uploaded=await request.post(`${API_URL}/items/${first.id}/image`,{headers:auth(owner.accessToken),multipart:await photo()});
  const url=(await uploaded.json()).imageUrl;
  backend(`(async()=>{const {Client}=require('pg');const c=new Client({host:process.env.POSTGRES_HOST,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD,database:process.env.POSTGRES_DB});await c.connect();await c.query('UPDATE list_items SET image_bytes=104857600 WHERE id=$1',[process.argv[1]]);await c.end()})().catch(()=>process.exit(1))`,first.id);
  expect((await request.post(`${API_URL}/items/${second.id}/image`,{headers:auth(owner.accessToken),multipart:await photo()})).status()).toBe(413);
  expect((await request.get(API_URL+url)).status()).toBe(200);
  const concurrency=backend(`(async()=>{const {ItemImageStorage}=require('./dist/modules/items/item-image.storage');const s=new ItemImageStorage(null);let release;const wait=new Promise(r=>release=r);const a=s.limited(()=>wait),b=s.limited(()=>wait);let denied=false;try{await s.limited(async()=>true)}catch(e){denied=e.getStatus()===429}release();await Promise.all([a,b]);const recovered=await s.limited(async()=>true);process.stdout.write(JSON.stringify({denied,recovered}))})().catch(()=>process.exit(1))`);
  expect(JSON.parse(concurrency)).toEqual({denied:true,recovered:true});
  await request.delete(`${API_URL}/lists/${list.id}`,{headers:auth(owner.accessToken)});
});
