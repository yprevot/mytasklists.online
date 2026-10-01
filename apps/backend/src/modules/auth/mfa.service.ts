import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { User } from '../../database/entities';
import { CacheService } from '../../redis/cache.service';
import { UsersService } from '../users/users.service';
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  otpauthUrl,
  TOTP_STEP_SECONDS,
  verifyTotp,
} from './totp';

const SETUP_TTL_SECONDS = 10 * 60;
const CHALLENGE_TTL_SECONDS = 5 * 60;
const CHALLENGE_MAX_ATTEMPTS = 5;
const ISSUER = 'ListaDeCompras';

interface ChallengeState {
  userId: string;
  attempts: number;
}

/**
 * Verificación en dos pasos (TOTP) y los retos que se emiten en el login
 * cuando una cuenta la tiene activa.
 */
@Injectable()
export class MfaService {
  constructor(
    private readonly users: UsersService,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {}

  private get keyMaterial(): string {
    return this.config.get<string>('encryptionKey', '');
  }

  // ── Alta ───────────────────────────────────────────────────────────────
  async startSetup(user: User): Promise<{ secret: string; otpauthUrl: string }> {
    if (user.totpEnabled) throw new BadRequestException('La verificación en dos pasos ya está activa');
    const secret = generateTotpSecret();
    await this.cache.set(
      CacheService.mfaSetupKey(user.id),
      { secret: encryptSecret(secret, this.keyMaterial) },
      SETUP_TTL_SECONDS,
    );
    return { secret, otpauthUrl: otpauthUrl(secret, user.email, ISSUER) };
  }

  async confirmSetup(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const pending = await this.cache.get<{ secret: string }>(CacheService.mfaSetupKey(userId));
    if (!pending) throw new BadRequestException('El alta expiró. Vuelve a generar el código QR.');
    const secret = decryptSecret(pending.secret, this.keyMaterial);
    const step = verifyTotp(secret, code);
    if (step === null) throw new BadRequestException('El código no es correcto');

    const recoveryCodes = generateRecoveryCodes();
    await this.users.setTotp(userId, {
      secret: pending.secret,
      enabled: true,
      recoveryCodes: recoveryCodes.map(hashRecoveryCode),
    });
    await this.cache.del(CacheService.mfaSetupKey(userId));
    await this.rememberStep(userId, step);
    return { recoveryCodes };
  }

  async disable(userId: string): Promise<void> {
    await this.users.setTotp(userId, { secret: null, enabled: false, recoveryCodes: null });
  }

  // ── Comprobación de un código ──────────────────────────────────────────
  /** Acepta un código TOTP o un código de recuperación (que se consume) */
  async verifyCode(userId: string, code: string): Promise<boolean> {
    const user = await this.users.findByIdWithSecrets(userId);
    if (!user.totpEnabled || !user.totpSecret) return false;

    const trimmed = code.trim();
    if (/^\d{6}$/.test(trimmed.replace(/\s+/g, ''))) {
      const step = verifyTotp(decryptSecret(user.totpSecret, this.keyMaterial), trimmed);
      if (step === null) return false;
      // Un mismo código no se acepta dos veces (protección contra repetición)
      const last = await this.cache.get<number>(CacheService.mfaLastStepKey(userId));
      if (last !== null && step <= last) return false;
      await this.rememberStep(userId, step);
      return true;
    }

    const hash = hashRecoveryCode(trimmed);
    const remaining = user.totpRecoveryCodes ?? [];
    if (!remaining.includes(hash)) return false;
    await this.users.setRecoveryCodes(userId, remaining.filter((entry) => entry !== hash));
    return true;
  }

  private async rememberStep(userId: string, step: number): Promise<void> {
    await this.cache.set(CacheService.mfaLastStepKey(userId), step, TOTP_STEP_SECONDS * 3);
  }

  // ── Retos del login ────────────────────────────────────────────────────
  async createChallenge(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.cache.set(
      CacheService.mfaChallengeKey(token),
      { userId, attempts: 0 } satisfies ChallengeState,
      CHALLENGE_TTL_SECONDS,
    );
    return token;
  }

  /** Valida el reto; tras varios códigos erróneos el reto se invalida */
  async resolveChallenge(token: string, code: string): Promise<string> {
    const key = CacheService.mfaChallengeKey(token);
    const state = await this.cache.get<ChallengeState>(key);
    if (!state) throw new UnauthorizedException('El inicio de sesión expiró. Vuelve a empezar.');

    if (await this.verifyCode(state.userId, code)) {
      await this.cache.del(key);
      return state.userId;
    }

    const attempts = state.attempts + 1;
    if (attempts >= CHALLENGE_MAX_ATTEMPTS) {
      await this.cache.del(key);
      throw new UnauthorizedException('Demasiados códigos incorrectos. Vuelve a iniciar sesión.');
    }
    await this.cache.set(key, { ...state, attempts }, CHALLENGE_TTL_SECONDS);
    throw new UnauthorizedException('El código no es correcto');
  }
}
