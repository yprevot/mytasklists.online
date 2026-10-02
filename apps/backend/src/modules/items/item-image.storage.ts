import { Injectable, Logger, NotFoundException, UnsupportedMediaTypeException, HttpException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile, stat, opendir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import sharp from 'sharp';

sharp.concurrency(1);
sharp.cache({ memory: 16, files: 0, items: 20 });

const TYPES = new Map<string, { extension: string; signature: (bytes: Buffer) => boolean }>([
  ['image/jpeg', { extension: '.jpg', signature: b => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff }],
  ['image/png', { extension: '.png', signature: b => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }],
  ['image/webp', { extension: '.webp', signature: b => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' }],
]);

@Injectable()
export class ItemImageStorage {
  private readonly root = resolve(process.env.ITEM_IMAGE_DIR || join(process.cwd(), 'uploads', 'items'));
  private readonly logger = new Logger(ItemImageStorage.name);
  private active = 0;
  private cleaning = false;
  constructor(private readonly db: DataSource) {}

  async size(key: string): Promise<number> { return (await stat(join(this.root, key))).size; }

  /** Admission before buffering multipart bodies, including decompression and writing. */
  async limited<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= 2) throw new HttpException('Hay varias imágenes procesándose. Inténtalo en unos segundos.', 429);
    this.active++;
    try { return await work(); } finally { this.active--; }
  }

  @Interval(5000)
  async cleanDeleted(): Promise<void> {
    if (this.cleaning) return;
    this.cleaning = true;
    try {
      await this.db.transaction(async manager => {
        const rows = await manager.query(`SELECT image_key FROM image_deletions WHERE available_at<=now()
          ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED`);
        for (const row of rows) {
          const [live] = await manager.query('SELECT id FROM list_items WHERE image_key=$1 LIMIT 1', [row.image_key]);
          if (live) continue;
          try {
            await this.remove(row.image_key);
            await manager.query('DELETE FROM image_deletions WHERE image_key=$1', [row.image_key]);
          } catch {
            await manager.query("UPDATE image_deletions SET attempts=attempts+1,available_at=now()+interval '1 minute' WHERE image_key=$1", [row.image_key]);
            this.logger.warn('Limpieza de imagen pendiente; se reintentará');
          }
        }
      });
    } catch { this.logger.warn('No se pudo ejecutar la limpieza de imágenes'); }
    finally { this.cleaning = false; }
  }

  /** Stream directory entries; the one-hour grace protects uploads not yet committed. */
  @Interval(3600000)
  async reconcile(): Promise<void> {
    try {
      const directory = await opendir(this.root);
      for await (const entry of directory) {
        if (!entry.isFile() || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(entry.name)) continue;
        const info = await stat(join(this.root, entry.name)).catch(() => null);
        if (!info || Date.now() - info.mtimeMs < 3600000) continue;
        const [live] = await this.db.query('SELECT id FROM list_items WHERE image_key=$1 LIMIT 1', [entry.name]);
        if (!live) await this.db.query('INSERT INTO image_deletions(image_key) VALUES($1) ON CONFLICT DO NOTHING', [entry.name]);
        else await this.db.query('UPDATE list_items SET image_bytes=$2 WHERE image_key=$1 AND image_bytes=0', [entry.name, info.size]);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.logger.warn('Conciliación de imágenes pendiente');
    }
  }

  async save(buffer: Buffer, declaredType: string): Promise<string> {
    const type = TYPES.get(declaredType);
    if (!type || !type.signature(buffer)) throw new UnsupportedMediaTypeException('Usa una imagen JPEG, PNG o WebP válida.');
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new UnsupportedMediaTypeException('La imagen no puede superar 5 MB.');
    let normalized: Buffer;
    try {
      normalized = await sharp(buffer, { limitInputPixels: 40_000_000, failOn: 'warning' })
        .rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' }).jpeg({ quality: 82 }).toBuffer();
    } catch { throw new UnsupportedMediaTypeException('La imagen está dañada o es demasiado grande. Usa otra imagen.'); }
    await mkdir(this.root, { recursive: true, mode: 0o750 });
    const key = `${randomUUID()}.jpg`;
    await writeFile(join(this.root, key), normalized, { flag: 'wx', mode: 0o640 });
    return key;
  }

  async read(key: string): Promise<{ buffer: Buffer; contentType: string }> {
    const type = [...TYPES].find(([, value]) => value.extension === extname(key));
    if (!type || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key)) throw new NotFoundException('La imagen no existe.');
    try { return { buffer: await readFile(join(this.root, key)), contentType: type[0] }; }
    catch { throw new NotFoundException('La imagen no existe.'); }
  }

  async remove(key: string | null | undefined): Promise<void> {
    if (!key || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key)) return;
    try { await unlink(join(this.root, key)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
}
