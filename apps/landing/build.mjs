/**
 * "Build" de la landing: copia src/ a dist/ sustituyendo los enlaces de las
 * tiendas por los valores de entorno. Sin dependencias.
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
};

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp(SRC, OUT, { recursive: true });

for (const entry of await readdir(OUT, { withFileTypes: true })) {
  if (!entry.isFile() || !/\.(html|css|js|webmanifest)$/.test(entry.name)) continue;
  const path = join(OUT, entry.name);
  let content = await readFile(path, 'utf8');
  for (const [token, value] of Object.entries(replacements)) {
    content = content.replaceAll(token, value);
  }
  await writeFile(path, content);
}

console.log(`[landing] generado en dist/ con iOS=${replacements.__IOS_URL__}`);
