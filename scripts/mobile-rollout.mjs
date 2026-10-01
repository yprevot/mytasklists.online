#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const parse=v=>/^\d+\.\d+\.\d+$/.test(v||'')?v.split('.').map(Number):null;
const compare=(a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2];
export function validateRollout({phase='bridge',minimum='1.0.0',ready='',appVersion}){
 const min=parse(minimum),app=parse(appVersion),published=ready?parse(ready):null;
 if(!min||!app||ready&&!published)throw Error('Las versiones deben usar x.y.z');
 if(!['bridge','enforced'].includes(phase))throw Error('Fase inválida');
 if(compare(min,app)>0)throw Error('La versión mínima supera la app de este checkout');
 if(phase==='bridge'&&compare(min,[2,0,0])>=0)throw Error('bridge no permite cortar las apps 1.x');
 if(phase==='enforced'&&(compare(min,[2,0,0])<0||!published||compare(published,min)<0))throw Error('El corte requiere mínimo >=2.0.0 y confirmación MOBILE_RELEASE_READY_VERSION >= mínimo');
 return {phase,minimum,ready:ready||null,appVersion};
}
export async function verifyServer(url,policy,{before=false,fetcher=fetch}={}){
 const origin=new URL(url);if(!['http:','https:'].includes(origin.protocol))throw Error('URL inválida');
 const base=origin.href.replace(/\/$/,'');
 const get=async path=>{const r=await fetcher(base+path,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);return r.json();};
 const compat=await get('/api/app/compatibility');
 if(compat.registrationFlow!==2)throw Error('El servidor todavía no ofrece registro por correo (flujo 2)');
 if(!before&&(compat.rolloutPhase!==policy.phase||compat.minVersion!==policy.minimum))throw Error('La configuración efectiva del servidor no coincide con la fase y mínimo solicitados');
 if(compare(parse(compat.minVersion)||[999,0,0],parse(policy.appVersion))>0)throw Error('El servidor bloquea el cliente nuevo');
 if(policy.phase==='enforced'){
  const dist=await get('/api/distribution');
  const androidApk=dist.android?.apk;
  if(!dist.android?.storeUrl&&!(androidApk&&parse(androidApk.version)&&compare(parse(androidApk.version),parse(policy.minimum))>=0))throw Error('No hay actualización Android publicada que alcance la versión mínima');
  if(!dist.ios?.storeUrl&&!dist.ios?.testflightUrl)throw Error('No hay actualización iOS publicada o TestFlight configurado');
 }
 return compat;
}
async function main(){
 const args=process.argv.slice(2);const option=name=>args.find(a=>a.startsWith('--'+name+'='))?.split('=').slice(1).join('=');
 const app=JSON.parse(await readFile(new URL('../apps/mobile/app.json',import.meta.url),'utf8')).expo;
 const policy=validateRollout({phase:process.env.MOBILE_ROLLOUT_PHASE||'bridge',minimum:process.env.MOBILE_MIN_VERSION||'1.0.0',ready:process.env.MOBILE_RELEASE_READY_VERSION||'',appVersion:app.version});
 const url=option('url')||process.env.SITE_URL;
 if(!args.includes('--static')){if(!url)throw Error('Indica --url=https://sitio o SITE_URL; --static revisa solo la configuración candidata');await verifyServer(url,policy,{before:args.includes('--before')});}
 console.log(JSON.stringify({...policy,check:args.includes('--static')?'configuration-only':args.includes('--before')?'server-before-cut':'server-effective'},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
