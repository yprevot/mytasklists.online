#!/usr/bin/env node
// Native release, production HTTPS, persistent private signing key (never in git).
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {homedir} from 'node:os';
import {resolve,join} from 'node:path';
const root=resolve(new URL('../',import.meta.url).pathname),mobile=join(root,'apps/mobile');
const keyDir=join(homedir(),'.codex/secrets/mytasklists-android');await mkdir(keyDir,{recursive:true,mode:0o700});await chmod(keyDir,0o700);
const javaHome=process.env.JAVA_HOME||'/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home';
const sdk=process.env.ANDROID_HOME||join(homedir(),'Library/Android/sdk');
const credentials=join(keyDir,'signing.json'),keystore=join(keyDir,'release.keystore');
let signing;try{signing=JSON.parse(await readFile(credentials,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;signing={alias:'mytasklists',password:randomBytes(32).toString('base64url')};await writeFile(credentials,JSON.stringify(signing)+'\n',{mode:0o600});}
const env={...process.env,JAVA_HOME:javaHome,ANDROID_HOME:sdk,PATH:javaHome+'/bin:'+process.env.PATH,MYTASKLISTS_LOCAL_RELEASE:'true',EXPO_PUBLIC_BILLING_CHANNEL:'direct',EXPO_PUBLIC_API_URL:'https://mytasklists.online/api',EXPO_PUBLIC_SOCKET_URL:'https://mytasklists.online',APKSIGNER:process.env.APKSIGNER||join(sdk,'build-tools/37.0.0/apksigner'),MYTASKLISTS_KEYSTORE:keystore,MYTASKLISTS_KEY_ALIAS:signing.alias,MYTASKLISTS_KEY_PASSWORD:signing.password};
const run=(command,args,cwd=mobile)=>new Promise((res,rej)=>{const p=spawn(command,args,{cwd,env,stdio:'inherit'});p.on('error',rej);p.on('exit',code=>code===0?res():rej(Error(`${command} exited ${code}`)));});
try{await readFile(keystore);}catch(e){if(e.code!=='ENOENT')throw e;await run(join(javaHome,'bin/keytool'),['-genkeypair','-keystore',keystore,'-storepass:env','MYTASKLISTS_KEY_PASSWORD','-keypass:env','MYTASKLISTS_KEY_PASSWORD','-alias',signing.alias,'-keyalg','RSA','-keysize','4096','-validity','10000','-dname','CN=MyTaskLists Android']);await chmod(keystore,0o600);}
await run('npx',['expo','prebuild','--platform','android','--no-install']);
const gradle=join(mobile,'android/app/build.gradle');let text=await readFile(gradle,'utf8');
if(!text.includes('productionDirect {'))text=text.replace('    signingConfigs {',`    signingConfigs {
        productionDirect {
            storeFile file(System.getenv('MYTASKLISTS_KEYSTORE'))
            storePassword System.getenv('MYTASKLISTS_KEY_PASSWORD')
            keyAlias System.getenv('MYTASKLISTS_KEY_ALIAS')
            keyPassword System.getenv('MYTASKLISTS_KEY_PASSWORD')
        }`);
text=text.replace(/(release\s*\{[\s\S]*?signingConfig\s*=\s*)signingConfigs.debug/,'$1signingConfigs.productionDirect');
if(!text.includes('signingConfig = signingConfigs.productionDirect'))throw Error('Release signing could not be configured');
await writeFile(gradle,text);await writeFile(join(mobile,'android/local.properties'),'sdk.dir='+sdk.replace(/ /g,'\\ ')+'\n');
await run('./gradlew',['assembleRelease','--no-daemon','--console=plain','--max-workers=2','-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=2048m'],join(mobile,'android'));
const apk=join(mobile,'android/app/build/outputs/apk/release/app-release.apk');
const version=JSON.parse(await readFile(join(mobile,'app.json'),'utf8')).expo.version;
await run('node',[join(root,'scripts/publish-apk.mjs'),apk,version],root);
console.log(`Signed direct APK: downloads/mytasklists-${version}.apk. Signing key stored privately at ${keyDir}; preserve it for future updates.`);
