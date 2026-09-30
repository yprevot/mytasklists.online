import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * TOTP (RFC 6238) compatible con Google Authenticator, 1Password, Authy…
 * SHA-1, 6 dígitos, pasos de 30 s. Se implementa aquí (unas decenas de líneas)
 * para no sumar una dependencia al manejo de secretos.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const TOTP_STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Secreto base32 inválido');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return binary.toString().padStart(DIGITS, '0');
}

export const currentStep = (now = Date.now()): number => Math.floor(now / 1000 / TOTP_STEP_SECONDS);

/**
 * Devuelve el paso de tiempo que coincide con el código (tolerando ±1 paso de
 * desfase de reloj) o `null`. El paso se usa para impedir reutilizar un código.
 */
export function verifyTotp(secret: string, code: string, now = Date.now(), window = 1): number | null {
  const normalized = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) return null;
  const step = currentStep(now);
  for (let offset = -window; offset <= window; offset += 1) {
    const candidate = Buffer.from(totpCode(secret, step + offset));
    if (timingSafeEqual(candidate, Buffer.from(normalized))) return step + offset;
  }
  return null;
}

export function otpauthUrl(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ── Cifrado del secreto en reposo (AES-256-GCM) ───────────────────────────
const keyFrom = (material: string): Buffer => createHash('sha256').update(material).digest();

export function encryptSecret(plain: string, keyMaterial: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(keyMaterial), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

export function decryptSecret(payload: string, keyMaterial: string): string {
  const [version, iv, tag, data] = payload.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Formato de secreto cifrado desconocido');
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(keyMaterial), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

// ── Códigos de recuperación ───────────────────────────────────────────────
export const hashRecoveryCode = (code: string): string =>
  createHash('sha256').update(code.replace(/[\s-]+/g, '').toLowerCase()).digest('hex');

export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(5).toString('hex');
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}
