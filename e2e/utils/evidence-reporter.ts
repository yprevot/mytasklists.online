import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

const EVIDENCE_DIR = new URL('../evidence/', import.meta.url).pathname;

const slug = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

interface Entry {
  id: string;
  title: string;
  file: string;
  status: string;
  durationMs: number;
}

/**
 * Guarda un video por caso de prueba con un nombre legible:
 *
 *   evidence/frontend/CP-WEB-020-agregar-pan-de-caja-con-recurrencia-de-14-dias.webm
 *
 * y deja un INDICE.md con el resultado de cada caso.
 */
export default class EvidenceReporter implements Reporter {
  private readonly entries = new Map<string, Entry[]>();
  private startedAt = Date.now();

  onBegin(_config: FullConfig): void {
    this.startedAt = Date.now();
    rmSync(EVIDENCE_DIR, { recursive: true, force: true });
    mkdirSync(EVIDENCE_DIR, { recursive: true });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const videos = result.attachments.filter(
      (attachment) => attachment.name === 'video' && attachment.path,
    );
    if (!videos.length) return;

    const project = test.parent.project()?.name ?? 'otros';
    const targetDir = join(EVIDENCE_DIR, project);
    mkdirSync(targetDir, { recursive: true });

    const id = /^(CP-[A-Z]+-\d+)/.exec(test.title)?.[1] ?? slug(test.title).slice(0, 12);
    const description = test.title.replace(/^CP-[A-Z]+-\d+\s*·?\s*/, '');

    videos.forEach((video, position) => {
      // Un caso puede grabar mas de una ventana (pruebas con dos personas a la vez)
      const suffix = videos.length > 1 ? `-ventana${position + 1}` : '';
      const name = `${id}-${slug(description)}${suffix}.webm`;
      const target = join(targetDir, name);
      try {
        copyFileSync(video.path!, target);
      } catch {
        return;
      }

      const list = this.entries.get(project) ?? [];
      list.push({
        id,
        title: description,
        file: name,
        status: result.status,
        durationMs: result.duration,
      });
      this.entries.set(project, list);
    });
  }

  onEnd(result: FullResult): void {
    const lines = [
      '# Evidencia en video de las pruebas end-to-end',
      '',
      `Ejecucion: **${result.status}** · ${new Date().toLocaleString('es-MX')} · ` +
        `${Math.round((Date.now() - this.startedAt) / 1000)} s`,
      '',
      'Cada caso con interfaz grabo un video. Los archivos estan junto a este indice.',
      '',
    ];

    if (this.entries.size === 0) {
      lines.push('_No se grabo ningun video en esta ejecucion._');
    }

    for (const [project, entries] of [...this.entries.entries()].sort()) {
      lines.push(`## ${project} · ${entries.length} video(s)`, '');
      lines.push('| Caso | Descripcion | Resultado | Video |');
      lines.push('| --- | --- | --- | --- |');
      entries
        .sort((a, b) => a.file.localeCompare(b.file))
        .forEach((entry) => {
          const size = existsSync(join(EVIDENCE_DIR, project, entry.file))
            ? `${Math.round(statSync(join(EVIDENCE_DIR, project, entry.file)).size / 1024)} KB`
            : '—';
          const icon = entry.status === 'passed' ? 'OK' : entry.status;
          lines.push(
            `| ${entry.id} | ${entry.title} | ${icon} | [\`${entry.file}\`](./${project}/${entry.file}) (${size}) |`,
          );
        });
      lines.push('');
    }

    writeFileSync(join(EVIDENCE_DIR, 'INDICE.md'), lines.join('\n'));

    const total = [...this.entries.values()].reduce((sum, list) => sum + list.length, 0);
    // eslint-disable-next-line no-console
    console.log(`\n[e2e] ${total} video(s) de evidencia en e2e/evidence/ (ver INDICE.md)\n`);
  }
}
