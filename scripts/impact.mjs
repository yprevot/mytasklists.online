#!/usr/bin/env node
/**
 * Dice qué se despliega con los cambios actuales y qué tan seguro es hacerlo.
 *
 *   node scripts/impact.mjs [rama-base]          informe en Markdown (por defecto origin/main)
 *   node scripts/impact.mjs [rama-base] --json   lo mismo en JSON, para los workflows de CI
 *
 * Compara contra el punto donde la rama se separó de la base e incluye lo que aún
 * no está en un commit. Las reglas están explicadas en docs/COMPATIBILIDAD.md.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkContract } from './contract-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const base = args.find((arg) => !arg.startsWith('--')) ?? 'origin/main';

let mergeBase;
try {
  mergeBase = git('merge-base', base, 'HEAD').trim();
} catch {
  console.error(`No encuentro la rama base "${base}". Pásala como argumento: node scripts/impact.mjs main`);
  process.exit(2);
}

const lines = (text) => text.split('\n').filter(Boolean);
const files = [
  ...new Set([...lines(git('diff', '--name-only', mergeBase)), ...lines(git('ls-files', '--others', '--exclude-standard'))]),
];
const touched = (...prefixes) => files.filter((file) => prefixes.some((prefix) => file.startsWith(prefix)));

// ── Qué se despliega ────────────────────────────────────────────────────
const shared = touched('package.json', 'package-lock.json', 'packages/contracts/', 'packages/ui-data/');
const infra = touched('infra/', 'docker-compose', '.dockerignore');
const services = {
  backend: touched('apps/backend/'),
  frontend: touched('apps/frontend/'),
  dashboard: touched('apps/dashboard/'),
  landing: touched('apps/landing/'),
};
const mobileFiles = touched('apps/mobile/', 'packages/ui-data/');

// Lo que cambia el binario nativo: dependencias, configuración de Expo, iconos y splash
const NATIVE = ['app.json', 'app.config.', 'package-lock.json', 'eas.json', 'ios/', 'android/', 'plugins/', 'assets/', 'metro.config.'];

/** En package.json solo importan las dependencias: los scripts no llegan al binario */
function mobileDependenciesChanged() {
  const file = 'apps/mobile/package.json';
  const now = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  let before = {};
  try {
    before = JSON.parse(git('show', `${mergeBase}:${file}`));
  } catch {
    return true;
  }
  return JSON.stringify(before.dependencies ?? {}) !== JSON.stringify(now.dependencies ?? {});
}

const mobileNative = mobileFiles.filter(
  (file) =>
    NATIVE.some((entry) => file.startsWith(`apps/mobile/${entry}`)) ||
    (file === 'apps/mobile/package.json' && mobileDependenciesChanged()),
);

// ── Riesgos ─────────────────────────────────────────────────────────────
const warnings = [];
const warn = (level, text) => warnings.push({ level, text });

let contract = null;
if (touched('packages/contracts/').length) {
  contract = checkContract(base);
  if (contract.breaking.length && !contract.approved) {
    warn(
      'alto',
      `El contrato rompe a las apps publicadas (${contract.breaking.map((entry) => entry.name).join(', ')}). ` +
        'Hazlo en dos pasos o sube la versión mayor del contrato. `npm run contract:check` da el detalle.',
    );
  } else if (contract.breaking.length) {
    warn(
      'alto',
      `Cambio incompatible aprobado (contrato ${contract.oldVersion} → ${contract.newVersion}). Orden obligatorio: ` +
        (contract.breaking.some(change=>change.name==='registrationFlow')
          ? 'backend en bridge primero, publicar el binario movil, verificar disponibilidad/adopcion y solo entonces usar enforced con MOBILE_MIN_VERSION.'
          : 'publicar la app que ya no usa lo retirado, esperar su adopción, subir MOBILE_MIN_VERSION y después desplegar el backend.'),
    );
  }
}

const migrations = touched('apps/backend/src/database/migrations/');
if (migrations.length) {
  warn(
    'medio',
    `Migraciones de base de datos (${migrations.length}). Deben funcionar con el backend anterior mientras conviven: ` +
      'agrega columnas nullable o con valor por defecto y no borres ni renombres en el mismo despliegue.',
  );
}

// Rutas que desaparecen: las apps publicadas las siguen llamando. Se compara la API
// completa (prefijo del controlador + método) para no confundir una ruta movida de
// archivo con una ruta quitada.
function routesOf(sources) {
  const routes = new Set();
  const clean = (value) => (value ?? '').replace(/^\/+|\/+$/g, '');
  for (const source of sources) {
    const prefix = clean(/@Controller\(\s*'([^']*)'/.exec(source)?.[1]);
    for (const [, method, route] of source.matchAll(/@(Get|Post|Patch|Put|Delete)\(\s*(?:'([^']*)')?/g)) {
      routes.add(`${method.toUpperCase()} /${[prefix, clean(route)].filter(Boolean).join('/')}`);
    }
  }
  return routes;
}
const CONTROLLERS = /^apps\/backend\/src\/.*\.controller\.ts$/;
const removedRoutes = [];
if (touched('apps/backend/src/').some((file) => CONTROLLERS.test(file))) {
  const before = routesOf(
    lines(git('ls-tree', '-r', '--name-only', mergeBase, 'apps/backend/src'))
      .filter((file) => CONTROLLERS.test(file))
      .map((file) => git('show', `${mergeBase}:${file}`)),
  );
  const now = routesOf(
    lines(git('ls-files', '--cached', '--others', '--exclude-standard', 'apps/backend/src'))
      .filter((file) => CONTROLLERS.test(file) && fs.existsSync(path.join(ROOT, file)))
      .map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8')),
  );
  removedRoutes.push(...[...before].filter((route) => !now.has(route)));
}
if (removedRoutes.length) {
  warn(
    'alto',
    `Se quitaron rutas de la API: ${removedRoutes.join(', ')}. Si la app móvil las usa, las versiones publicadas ` +
      'dejan de funcionar: agrega la ruta nueva y conserva la vieja hasta subir MOBILE_MIN_VERSION.',
  );
}

if (touched('apps/backend/src/modules/realtime/').length) {
  warn('medio', 'Cambios en tiempo real: conserva los eventos y campos que escuchan las apps publicadas.');
}

let mobileVersion = null;
if (mobileFiles.length) {
  const current = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/mobile/app.json'), 'utf8')).expo.version;
  let previous = null;
  try {
    previous = JSON.parse(git('show', `${mergeBase}:apps/mobile/app.json`)).expo.version;
  } catch {
    // app.json no existía en la base
  }
  mobileVersion = { previous, current };
  if (previous === current) {
    warn(
      'bajo',
      `La app móvil cambió pero su versión sigue en ${current}. Súbela en apps/mobile/app.json: es lo que permite ` +
        'exigirla después con MOBILE_MIN_VERSION.',
    );
  }
  if (mobileNative.length) {
    warn(
      'medio',
      `La app móvil necesita un build nuevo para las tiendas (${mobileNative.map((file) => file.replace('apps/mobile/', '')).join(', ')}). ` +
        'Las personas actualizan cuando quieren: el backend debe seguir atendiendo a la versión anterior.',
    );
  }
}

// ── Resultado ───────────────────────────────────────────────────────────
const deploysServices = Object.values(services).some((list) => list.length) || shared.length > 0 || infra.length > 0;
const mobileRelease = !mobileFiles.length ? 'ninguno' : mobileNative.length ? 'tienda' : 'ota';
const level = warnings.some((w) => w.level === 'alto') ? 'alto' : warnings.some((w) => w.level === 'medio') ? 'medio' : 'bajo';

const result = {
  base,
  mergeBase,
  files: files.length,
  level,
  services: {
    deploy: deploysServices,
    changed: Object.entries(services)
      .filter(([, list]) => list.length)
      .map(([name]) => name),
    shared: shared.length > 0,
    infra: infra.length > 0,
  },
  mobile: {
    changed: mobileFiles.length > 0,
    release: mobileRelease,
    nativeFiles: mobileNative,
    version: mobileVersion,
  },
  contract: contract && {
    compatible: contract.breaking.length === 0,
    approved: contract.approved,
    breaking: contract.breaking.map((entry) => entry.name),
  },
  warnings,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

const LEVEL = {
  bajo: '🟢 Sin miedo',
  medio: '🟡 Con cuidado',
  alto: '🔴 Coordinar antes de desplegar',
};
const out = [];
out.push(`## Impacto de los cambios contra \`${base}\``, '');
if (!files.length) {
  out.push('No hay cambios.');
} else {
  out.push(`**${LEVEL[level]}** · ${files.length} archivos`, '');
  out.push('| Qué | Cómo se publica | Afectado |', '| --- | --- | --- |');
  for (const [name, list] of Object.entries(services)) {
    const affected = list.length ? `${list.length} archivos` : shared.length || infra.length ? 'reconstruir' : '—';
    out.push(`| ${name} | Deploy de servicios (Docker) | ${affected} |`);
  }
  const mobileHow = {
    ninguno: '—',
    ota: 'Actualización OTA (EAS Update), sin pasar por la tienda',
    tienda: 'Build nuevo y revisión de App Store / Google Play',
  }[mobileRelease];
  out.push(`| app móvil | ${mobileHow} | ${mobileFiles.length ? `${mobileFiles.length} archivos` : '—'} |`);
  if (contract) {
    const state = !contract.breaking.length ? 'compatible' : contract.approved ? 'incompatible (aprobado)' : 'incompatible';
    out.push(`| contrato | Lo usan todos los anteriores | ${state} |`);
  }
  out.push('');
  if (warnings.length) {
    const icon = { alto: '🔴', medio: '🟡', bajo: '🔵' };
    out.push('### Qué revisar', '');
    for (const w of warnings) out.push(`- ${icon[w.level]} ${w.text}`);
  } else {
    out.push('Nada que coordinar: cada parte se puede desplegar por su lado.');
  }
}
console.log(out.join('\n'));
