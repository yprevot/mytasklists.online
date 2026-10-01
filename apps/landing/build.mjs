import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { EN } from './translations.mjs';
const SRC = new URL('./src/', import.meta.url).pathname;
const OUT = new URL('./dist/', import.meta.url).pathname;
const origin = (process.env.LANDING_PUBLIC_URL || 'https://mytasklists.online').replace(/\/$/,'');
if (!/^https?:\/\//.test(origin)) throw new Error('LANDING_PUBLIC_URL must be absolute');
const app = (process.env.LANDING_APP_URL || '/app/').replace(/\/?$/,'/');
const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const replace = (s,en=false) => {
  const values = {__APP_URL__:app,__LOGIN_URL__:app+'login',__DOWNLOAD_URL__:en?'/en/download/':'/descargar/',__PRICING_URL__:en?'/en/pricing/':'/precios/',__YEAR__:String(new Date().getFullYear()),__LEGAL_NAME__:process.env.LANDING_LEGAL_NAME||'MyTaskListsOnline',__LEGAL_ADDRESS__:process.env.LANDING_LEGAL_ADDRESS||'',__PRIVACY_EMAIL__:process.env.LANDING_PRIVACY_EMAIL||'privacidad@mytasklists.online'};
  for(const [key,value] of Object.entries(values)) s=s.replaceAll(key,escape(value));
  return s.replace(/(href|src)="\.\//g,'$1="/');
};
const seo = (html,path,alternate,title,description,en) => {
  html=html.replace(/<title>[\s\S]*?<\/title>/,`<title>${escape(title)}</title>`).replace(/<meta\s+name="description"[\s\S]*?\/>/,`<meta name="description" content="${escape(description)}" />`);
  html=html.replace(/<meta\s+property="og:[\s\S]*?\/>/g,'').replace('<html lang="es">',`<html lang="${en?'en':'es'}">`);
  if(process.env.LANDING_NOINDEX==='true')html=html.replace('</head>','<meta name="robots" content="noindex, nofollow"/></head>');
  const canonical=origin+path;
  const schema={'@context':'https://schema.org','@type':'SoftwareApplication',name:'MyTaskLists',applicationCategory:'ProductivityApplication',operatingSystem:'Web, Android, iOS',url:canonical,description};
  return html.replace('</head>',`<link rel="canonical" href="${canonical}" />
<link rel="alternate" hreflang="${en?'en':'es'}" href="${canonical}" />
<link rel="alternate" hreflang="${en?'es':'en'}" href="${origin+alternate}" />
<link rel="alternate" hreflang="x-default" href="${origin+(en?alternate:path)}" />
<meta property="og:title" content="${escape(title)}"/><meta property="og:description" content="${escape(description)}"/>
<meta property="og:type" content="website"/><meta property="og:url" content="${canonical}"/><meta property="og:locale" content="${en?'en_US':'es_MX'}"/>
<meta property="og:image" content="${origin}/social.png"/><meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/><meta property="og:image:alt" content="MyTaskLists · ${en?'Shared shopping lists':'Listas de compras compartidas'}"/>
<meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${escape(title)}"/><meta name="twitter:description" content="${escape(description)}"/><meta name="twitter:image" content="${origin}/social.png"/>
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>
</head>`);
};
const shell=(en,title,body,script='')=>`<!doctype html><html lang="${en?'en':'es'}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title><meta name="description" content="${title}"/><link rel="icon" href="/favicon.svg"/><link rel="stylesheet" href="/styles.css"/></head><body>
<header class="nav commerce-nav"><div class="wrap"><a class="brand" href="${en?'/en/':'/'}">MyTaskLists</a><nav class="nav-links" aria-label="${en?'Main':'Principal'}"><a href="${en?'/en/pricing/':'/precios/'}">${en?'Pricing':'Precios'}</a><a href="${en?'/en/download/':'/descargar/'}">${en?'Download':'Descargar'}</a><a class="btn btn-ghost" href="__LOGIN_URL__">${en?'Sign in':'Ingresar'}</a><a href="${en?'/':'/en/'}" lang="${en?'es':'en'}">${en?'ES':'EN'}</a></nav></div></header>
<main class="wrap commerce"><h1>${title}</h1>${body}</main><footer><div class="wrap"><span>© __YEAR__ MyTaskLists</span><a href="${en?'/privacy':'/privacidad'}">${en?'Privacy':'Privacidad'}</a><a href="${en?'/terms':'/terminos'}">${en?'Terms':'Condiciones'}</a></div></footer>${script?`<script src="/${script}"></script>`:''}</body></html>`;
await rm(OUT,{recursive:true,force:true});await mkdir(OUT,{recursive:true});await cp(SRC,OUT,{recursive:true});
for(const entry of await readdir(OUT,{withFileTypes:true})) if(entry.isFile()&&/\.(html|css|js)$/.test(entry.name)) await writeFile(join(OUT,entry.name),replace(await readFile(join(OUT,entry.name),'utf8')));
let landing=await readFile(join(SRC,'index.html'),'utf8');
for(const en of [false,true]) {
  let html=landing;
  if(en) {
    html=html.replace(/(<([a-z0-9]+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/gi,(_,start,tag,key,content,end)=>start+(EN[key]||content)+end);
    html=html.replace(/>Precios</g,'>Pricing<').replace(/>Descargar</g,'>Download<').replace(/>iPhone y iPad</g,'>iPhone and iPad<');
    html=html.replace(/href="\/privacidad"/g,'href="/privacy"').replace(/href="\/terminos"/g,'href="/terms"');
  }
  html=seo(replace(html,en),en?'/en/':'/',en?'/':'/en/',en?'Shared shopping lists | MyTaskLists':'Listas de compras compartidas | MyTaskLists',en?'Share grocery lists with your family. Recurring products return automatically and everyone sees changes in real time.':'Comparte listas de compras con tu familia. Los productos recurrentes vuelven automáticamente y todos ven los cambios en tiempo real.',en);
  await mkdir(join(OUT,en?'en':''),{recursive:true});await writeFile(join(OUT,en?'en/index.html':'index.html'),html);
  const pricing=shell(en,en?'Choose your plan':'Elige tu plan',`<p class="lede">${en?'Organize shopping with one account across your devices.':'Organiza tus compras con una cuenta en todos tus dispositivos.'}</p><div class="price-grid"><section><h2>${en?'Free':'Gratis'}</h2><p class="price">0 <span>USD</span></p><p>${en?'Start organizing and sharing your shopping lists. No card required.':'Empieza a organizar y compartir tus listas de compras. Sin tarjeta.'}</p><a class="btn btn-ghost" href="${app}register">${en?'Create free account':'Crear cuenta gratis'}</a></section><section><h2>Premium</h2><p class="price">5 <span>USD / ${en?'month':'mes'}</span></p><p>${en?'Monthly subscription for your account.':'Suscripción mensual para tu cuenta.'}</p><p id="premium-benefits"></p><a class="btn btn-primary" href="${app}billing" data-testid="choose-premium">${en?'View subscription':'Ver suscripción'}</a></section></div><h2>${en?'Before you subscribe':'Antes de suscribirte'}</h2><p>${en?'Review the available benefits and final amount before paying. Renewals are monthly; cancel from your account. Promotional discounts and their duration appear before confirmation. Store prices may use local currency.':'Revisa los beneficios disponibles y el importe final antes de pagar. La renovación es mensual; puedes cancelar desde tu cuenta. Los descuentos promocionales y su duración aparecen antes de confirmar. Las tiendas pueden mostrar precios en moneda local.'}</p>`,'pricing.js');
  const download=shell(en,en?'Use MyTaskLists on your device':'Usa MyTaskLists en tu dispositivo',`<p class="lede">${en?'Your lists travel with you. Choose how to access them.':'Tus listas van contigo. Elige cómo acceder.'}</p><section id="android" class="download-section"><h2>Android</h2><p id="android-status" role="status">${en?'Checking available downloads…':'Comprobando descargas disponibles…'}</p><div id="android-actions"></div><p id="apk-info"></p><details><summary>${en?'How to install an APK':'Cómo instalar un APK'}</summary><p>${en?'Download the signed file. Android may ask you to allow installation from this browser. Follow the system prompts; you do not need to disable Play Protect.':'Descarga el archivo firmado. Android puede pedirte autorizar la instalación desde este navegador. Sigue las indicaciones del sistema; no necesitas desactivar Play Protect.'}</p></details></section><section id="ios" class="download-section"><h2>iPhone / iPad</h2><p>${en?'Use the web app now. Open it in Safari, tap Share, then Add to Home Screen.':'Usa la app web ahora. Ábrela en Safari, toca Compartir y después Añadir a pantalla de inicio.'}</p><a class="btn btn-primary" href="__APP_URL__">${en?'Open web app':'Usar app web'}</a><div id="ios-actions"></div><p>${en?'A native beta will appear here when available.':'La beta nativa aparecerá aquí cuando esté disponible.'}</p></section><section class="download-section"><h2>${en?'From any browser':'Desde cualquier navegador'}</h2><a class="btn btn-ghost" href="__LOGIN_URL__">${en?'Sign in':'Ingresar'}</a></section>`,'downloads.js');
  for(const [name,content,title,description] of [
    [en?'en/pricing':'precios',pricing,en?'Free and Premium plans | MyTaskLists':'Planes Gratis y Premium | MyTaskLists',en?'Start free or explore the monthly Premium subscription at 5 USD. Review pricing, promotions and renewal terms.':'Empieza gratis o conoce la suscripción Premium mensual de 5 USD. Revisa precios, promociones y condiciones de renovación.'],
    [en?'en/download':'descargar',download,en?'Downloads and web app | MyTaskLists':'Descargas y app web | MyTaskLists',en?'Find Android downloads and use MyTaskLists on iPhone, iPad or your browser.':'Encuentra descargas Android y usa MyTaskLists desde iPhone, iPad o tu navegador.']]) {
    const path='/'+name+'/';const alt=name.includes('pricing')?'/precios/':name==='precios'?'/en/pricing/':name.includes('download')?'/descargar/':'/en/download/';
    await mkdir(join(OUT,name),{recursive:true});await writeFile(join(OUT,name,'index.html'),seo(replace(content,en),path,alt,title,description,en));
  }
}
const legal=[['privacidad','privacy'],['terminos','terms']];
for(const [es,en] of legal) for(const name of [es,en]) {
 const isEn=name===en;const path=join(OUT,name+'.html');const html=await readFile(path,'utf8');const title=html.match(/<title>(.*?)<\/title>/)?.[1]||'MyTaskLists';await writeFile(path,seo(html,'/'+name,'/'+(isEn?es:en),title,isEn?'MyTaskLists policies and terms.':'Políticas y condiciones de MyTaskLists.',isEn));
}
const urls=['/','/en/','/precios/','/en/pricing/','/descargar/','/en/download/','/privacidad','/privacy','/terminos','/terms'];
await writeFile(join(OUT,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(path=>`<url><loc>${escape(origin+path)}</loc></url>`).join('')}</urlset>`);
await writeFile(join(OUT,'robots.txt'),process.env.LANDING_NOINDEX==='true'?'User-agent: *\nDisallow: /\n':`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`);
console.log('[landing] ES/EN, pricing, downloads and SEO generated');
