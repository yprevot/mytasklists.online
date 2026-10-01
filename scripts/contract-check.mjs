#!/usr/bin/env node
/**
 * Compara el contrato actual (packages/contracts) con el de otra rama y dice si
 * rompe a los clientes que ya están publicados.
 *
 *   node scripts/contract-check.mjs [rama-base]     (por defecto origin/main)
 *
 * Cómo lo decide:
 * - Lo que viaja del servidor al cliente (modelos, respuestas, ServerEvents) debe
 *   seguir encajando en la forma vieja: `Nuevo extends Viejo`. Agregar campos es
 *   seguro; quitar, renombrar o cambiar el tipo de uno, no.
 * - Lo que viaja del cliente al servidor (tipos `*Request` y ClientEvents) debe
 *   seguir aceptando lo que mandan las apps viejas: `Viejo extends Nuevo`. Agregar
 *   un campo opcional es seguro; uno obligatorio, no.
 *
 * Un cambio incompatible solo pasa si se sube la versión mayor de
 * packages/contracts/package.json (ver docs/COMPATIBILIDAD.md).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACTS = 'packages/contracts';

const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/** Tipos exportados por los .d.ts de un directorio, con su número de parámetros genéricos */
function exportedTypes(dir) {
  const types = new Map();
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.d.ts'))) {
    const source = ts.createSourceFile(file, fs.readFileSync(path.join(dir, file), 'utf8'), ts.ScriptTarget.Latest);
    for (const node of source.statements) {
      const exported = node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
      if (exported && (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node))) {
        types.set(node.name.text, node.typeParameters?.length ?? 0);
      }
    }
  }
  return types;
}

const travelsToServer = (name) => name.endsWith('Request') || name === 'ClientEvents' || name === 'ClientEventName';

const majorOf = (version) => Number(String(version).split('.')[0]);

/**
 * @returns {{ base: string, available: boolean, breaking: {name: string, reason: string}[],
 *            added: string[], oldVersion?: string, newVersion?: string, approved: boolean }}
 */
export function checkContract(base = 'origin/main') {
  let files;
  try {
    files = git('ls-tree', '--name-only', `${base}:${CONTRACTS}`).split('\n').filter(Boolean);
  } catch {
    // La rama base todavía no tiene contrato: no hay nada publicado con que comparar
    return { base, available: false, breaking: [], added: [], approved: true };
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-check-'));
  try {
    const oldDir = path.join(work, 'old');
    const newDir = path.join(work, 'new');
    fs.mkdirSync(oldDir);
    fs.cpSync(path.join(ROOT, CONTRACTS), newDir, { recursive: true });
    for (const file of files) {
      fs.writeFileSync(path.join(oldDir, file), git('show', `${base}:${CONTRACTS}/${file}`));
    }

    const oldTypes = exportedTypes(oldDir);
    const newTypes = exportedTypes(newDir);
    const breaking = [];
    const behavioralFile=path.join(newDir,'behavior.json');
    if(fs.existsSync(behavioralFile)) {
      const next=JSON.parse(fs.readFileSync(behavioralFile,'utf8'));
      const previous=fs.existsSync(path.join(oldDir,'behavior.json'))?JSON.parse(fs.readFileSync(path.join(oldDir,'behavior.json'),'utf8')):{};
      if(next.registrationFlow !== previous.registrationFlow) breaking.push({name:'registrationFlow',reason:'el registro directo exige actualizar clientes al flujo de correo previo'});
    }
    const lines = [
      "import type * as Old from './old/index';",
      "import type * as New from './new/index';",
      'type Fits<A, B> = [A] extends [B] ? true : false;',
      'type Expect<T extends true> = T;',
    ];
    const lineOwner = new Map();

    for (const [name, arity] of oldTypes) {
      if (!newTypes.has(name)) {
        breaking.push({ name, reason: 'se eliminó del contrato' });
        continue;
      }
      const args = arity ? `<${Array(arity).fill('unknown').join(', ')}>` : '';
      const [from, to] = travelsToServer(name) ? ['Old', 'New'] : ['New', 'Old'];
      lineOwner.set(lines.length + 1, name);
      lines.push(`export type Check_${name} = Expect<Fits<${from}.${name}${args}, ${to}.${name}${args}>>;`);
    }
    const checkFile = path.join(work, 'check.ts');
    fs.writeFileSync(checkFile, `${lines.join('\n')}\n`);

    const program = ts.createProgram([checkFile], {
      strict: true,
      noEmit: true,
      skipLibCheck: false,
      types: [],
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
    });
    for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
      if (diagnostic.file?.fileName !== checkFile || diagnostic.start === undefined) {
        breaking.push({ name: '(contrato)', reason: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ') });
        continue;
      }
      const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      const name = lineOwner.get(line + 1) ?? '(contrato)';
      if (breaking.some((entry) => entry.name === name)) continue;
      breaking.push({
        name,
        reason: travelsToServer(name)
          ? 'las apps publicadas mandan algo que el backend ya no aceptaría'
          : 'las apps publicadas esperan una forma que el backend ya no devolvería',
      });
    }

    const oldVersion = JSON.parse(git('show', `${base}:${CONTRACTS}/package.json`)).version;
    const newVersion = JSON.parse(fs.readFileSync(path.join(ROOT, CONTRACTS, 'package.json'), 'utf8')).version;
    const added = [...newTypes.keys()].filter((name) => !oldTypes.has(name));

    return {
      base,
      available: true,
      breaking,
      added,
      oldVersion,
      newVersion,
      approved: breaking.length === 0 || majorOf(newVersion) > majorOf(oldVersion),
    };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = checkContract(process.argv[2]);
  if (!result.available) {
    console.log(`${result.base} todavía no tiene ${CONTRACTS}: no hay contrato publicado con que comparar.`);
    process.exit(0);
  }
  if (!result.breaking.length) {
    const extra = result.added.length ? ` Tipos nuevos: ${result.added.join(', ')}.` : '';
    console.log(`Contrato compatible con ${result.base}: las apps publicadas siguen funcionando.${extra}`);
    process.exit(0);
  }
  console.log(`Cambios incompatibles con ${result.base}:`);
  for (const { name, reason } of result.breaking) console.log(`  - ${name}: ${reason}`);
  if (result.approved) {
    console.log(
      `\nAprobado por la versión mayor ${result.oldVersion} → ${result.newVersion}.` +
        (result.breaking.some(change=>change.name==='registrationFlow')
          ? '\nRegistro: backend en bridge primero, despues binario movil; enforced y MOBILE_MIN_VERSION solo tras confirmar su disponibilidad.'
          : '\nAntes de desplegar el backend, publica la app que ya no depende de lo retirado y sube MOBILE_MIN_VERSION.'),
    );
    process.exit(0);
  }
  console.log(
    '\nHazlo en dos pasos (agrega lo nuevo sin quitar lo viejo y retíralo cuando ninguna app lo use)' +
      '\no, si es inevitable, sube la versión mayor de packages/contracts/package.json.' +
      '\nDetalle: docs/COMPATIBILIDAD.md',
  );
  process.exit(1);
}
