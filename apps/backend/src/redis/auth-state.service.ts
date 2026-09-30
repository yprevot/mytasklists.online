import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/** Debe superar la vida de cualquier token; el refresh dura 30 días por defecto */
const VERSION_TTL_SECONDS = 45 * 24 * 3600;

export interface SessionState {
  disabled: boolean;
  version: number;
}

/**
 * Estado de sesión que el JwtAuthGuard y el gateway consultan en cada petición.
 *
 * Los access tokens son JWT sin estado, así que para poder cortarlos antes de
 * que expiren (cambio de contraseña, cuenta desactivada) se guardan dos marcas
 * en Redis:
 *  - `auth:session-version:<userId>`: cada token lleva la versión vigente al
 *    emitirse (`sv`); cerrar todas las sesiones la incrementa y los tokens con
 *    una versión anterior dejan de valer. Es exacto, sin depender del reloj.
 *  - `auth:disabled:<userId>`: la cuenta fue desactivada por administración.
 */
@Injectable()
export class AuthStateService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private static versionKey(userId: string): string {
    return `auth:session-version:${userId}`;
  }

  private static disabledKey(userId: string): string {
    return `auth:disabled:${userId}`;
  }

  async getSessionVersion(userId: string): Promise<number> {
    return Number((await this.redis.get(AuthStateService.versionKey(userId))) ?? 0);
  }

  /** Invalida todos los tokens emitidos hasta ahora para ese usuario */
  async bumpSessionVersion(userId: string): Promise<number> {
    const key = AuthStateService.versionKey(userId);
    const [[, version]] = (await this.redis
      .multi()
      .incr(key)
      .expire(key, VERSION_TTL_SECONDS)
      .exec()) as [[Error | null, number]];
    return version;
  }

  async setDisabled(userId: string, disabled: boolean): Promise<void> {
    if (disabled) await this.redis.set(AuthStateService.disabledKey(userId), '1');
    else await this.redis.del(AuthStateService.disabledKey(userId));
  }

  async getState(userId: string): Promise<SessionState> {
    const [version, disabled] = await this.redis.mget(
      AuthStateService.versionKey(userId),
      AuthStateService.disabledKey(userId),
    );
    return { disabled: disabled === '1', version: Number(version ?? 0) };
  }

  /** `true` si un token emitido con esa versión de sesión sigue siendo aceptable */
  async isTokenAllowed(userId: string, tokenVersion?: number): Promise<boolean> {
    const state = await this.getState(userId);
    return !state.disabled && (tokenVersion ?? 0) >= state.version;
  }
}
