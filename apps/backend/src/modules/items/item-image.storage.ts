import { Injectable, NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
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
