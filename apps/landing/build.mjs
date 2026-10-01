/**
 * "Build" de la landing: copia src/ a dist/ sustituyendo los enlaces de las
 * tiendas y los datos del responsable (páginas legales) por los valores de
 * entorno. Sin dependencias.
 */
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SRC = new URL('./src/', import.meta.url).pathname;
const OUT = new URL('./dist/', import.meta.url).pathname;

const replacements = {
  __IOS_URL__: process.env.LANDING_IOS_URL || '#descargar',
  __ANDROID_URL__: process.env.LANDING_ANDROID_URL || '#descargar',
  __APP_URL__: process.env.LANDING_APP_URL || '/app/',
  __YEAR__: String(new Date().getFullYear()),
  __LEGAL_NAME__: process.env.LANDING_LEGAL_NAME || 'MyTaskListsOnline',
  __LEGAL_ADDRESS__: process.env.LANDING_LEGAL_ADDRESS || 'Cuernavaca, Morelos, México',
  __PRIVACY_EMAIL__: process.env.LANDING_PRIVACY_EMAIL || 'privacidad@mytasklists.online',
};

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp(SRC, OUT, { recursive: true });

for (const entry of await readdir(OUT, { withFileTypes: true })) {
  if (!entry.isFile() || !/\.(html|css|js|webmanifest)$/.test(entry.name)) continue;
  const path = join(OUT, entry.name);
  let content = await readFile(path, 'utf8');
  // El domicilio de las páginas legales solo aparece si está configurado
  content = content.replace(/<!--address-->([\s\S]*?)<!--\/address-->/g, (_, text) =>
    replacements.__LEGAL_ADDRESS__ ? text : '',
  );
  for (const [token, value] of Object.entries(replacements)) {
    content = content.replaceAll(token, value);
  }
  await writeFile(path, content);
}

console.log(`[landing] generado en dist/ con iOS=${replacements.__IOS_URL__}`);
