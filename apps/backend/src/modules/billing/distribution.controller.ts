import { createHash } from 'node:crypto';
import { Controller, Get } from '@nestjs/common';
import { readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Public } from '../../common/decorators/public.decorator';
const allowed=(value:string|undefined,host:string)=>{try{const u=new URL(value||'');return u.protocol==='https:'&&u.hostname===host?u.href:null;}catch{return null;}};
@Controller('distribution')
export class DistributionController {
 private storeChecks=new Map<string,{expires:number,url:string|null}>();
 private artifactCheck:{key:string;valid:boolean}|null=null;
 private async availableStore(url:string|null){
  if(!url)return null;const old=this.storeChecks.get(url);if(old&&old.expires>Date.now())return old.url;
  let checked:string|null=url;try{const response=await fetch(url,{method:'HEAD',redirect:'follow',signal:AbortSignal.timeout(3000)});if(response.status===404||response.status===410)checked=null;}catch{/* A transient failure keeps the configured link and visible alternatives. */}
  this.storeChecks.set(url,{expires:Date.now()+600000,url:checked});return checked;
 }

 @Public() @Get()
 async manifest(){
  let apk:null|{url:string;version:string;size:number;sha256:string}=null;
  const root=process.env.DOWNLOADS_DIR||'/downloads';
  try{const m=JSON.parse(await readFile(join(root,'android.json'),'utf8'));const file=basename(m.file||'');
   if(file===m.file&&/\.apk$/.test(file)&&/^[a-f0-9]{64}$/.test(m.sha256)&&typeof m.version==='string'&&m.signed===true){const info=await stat(join(root,file));const key=file+':'+info.size+':'+info.mtimeMs+':'+m.sha256;if(this.artifactCheck?.key!==key)this.artifactCheck={key,valid:createHash('sha256').update(await readFile(join(root,file))).digest('hex')===m.sha256};if(info.isFile()&&info.size===m.size&&this.artifactCheck.valid)apk={url:'/downloads/'+encodeURIComponent(file),version:m.version,size:info.size,sha256:m.sha256};}
  }catch{/* No download until a verified signed artifact is published. */}
  return {android:{storeUrl:await this.availableStore(process.env.ANDROID_STORE_PUBLISHED==='true'?allowed(process.env.MOBILE_STORE_URL_ANDROID,'play.google.com'):null),apk},ios:{storeUrl:await this.availableStore(process.env.IOS_STORE_PUBLISHED==='true'?allowed(process.env.MOBILE_STORE_URL_IOS,'apps.apple.com'):null),testflightUrl:allowed(process.env.IOS_TESTFLIGHT_URL,'testflight.apple.com')}};
 }
}
