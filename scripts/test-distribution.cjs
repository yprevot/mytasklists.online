const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');const crypto=require('node:crypto');
const {DistributionController}=require('../apps/backend/dist/modules/billing/distribution.controller');
test('downloads only expose controlled, unchanged publication manifests',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mytasklists-distribution-test-'));process.env.DOWNLOADS_DIR=root;process.env.ANDROID_STORE_PUBLISHED='false';process.env.IOS_STORE_PUBLISHED='false';
 try{const service=new DistributionController();assert.equal((await service.manifest()).android.apk,null);
 const fixture=Buffer.from('isolated unit fixture, not an installable APK');await fs.writeFile(path.join(root,'fixture.apk'),fixture);
 const manifest={file:'fixture.apk',version:'2.0.0',signed:true,size:fixture.length,sha256:crypto.createHash('sha256').update(fixture).digest('hex')};await fs.writeFile(path.join(root,'android.json'),JSON.stringify(manifest));assert.equal((await service.manifest()).android.apk.url,'/downloads/fixture.apk');
 await fs.writeFile(path.join(root,'fixture.apk'),Buffer.alloc(fixture.length,1));assert.equal((await service.manifest()).android.apk,null);
 await fs.writeFile(path.join(root,'android.json'),JSON.stringify({...manifest,file:'../fixture.apk'}));assert.equal((await service.manifest()).android.apk,null);
 }finally{delete process.env.DOWNLOADS_DIR;await fs.rm(root,{recursive:true,force:true});}
});
