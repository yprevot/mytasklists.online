#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, copyFile, rename, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
const [source,version,rootArg]=process.argv.slice(2);
if(!source||!/^\d+\.\d+\.\d+(?:[-.a-zA-Z0-9]*)$/.test(version||''))throw new Error('Usage: node scripts/publish-apk.mjs release.apk 2.0.0 [downloads directory]');
const root=resolve(rootArg||'downloads');
// apksigner must come from Android SDK build-tools; verification failure stops publication.
execFileSync(process.env.APKSIGNER||'apksigner',['verify','--verbose',resolve(source)],{stdio:['ignore','pipe','pipe']});
const bytes=await readFile(source);if(bytes[0]!==0x50||bytes[1]!==0x4b)throw new Error('Invalid APK');
const file=`mytasklists-${version}.apk`;await mkdir(root,{recursive:true});
try{const existing=await readFile(join(root,file));if(!existing.equals(bytes))throw new Error('Version already published with different content');}catch(e){if(e.code!=='ENOENT')throw e;}
await copyFile(source,join(root,file+'.tmp'));await rename(join(root,file+'.tmp'),join(root,file));
const manifest={file,version,size:(await stat(join(root,file))).size,sha256:createHash('sha256').update(bytes).digest('hex'),signed:true,publishedAt:new Date().toISOString()};
await writeFile(join(root,'android.json.tmp'),JSON.stringify(manifest,null,2)+'\n');await rename(join(root,'android.json.tmp'),join(root,'android.json'));
console.log(`Published verified APK: ${file}`);
