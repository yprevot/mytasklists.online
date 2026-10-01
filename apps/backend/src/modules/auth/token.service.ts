import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { User } from '../../database/entities';
import { CacheService } from '../../redis/cache.service';
import { AuthStateService } from '../../redis/auth-state.service';
import { JwtPayload } from '../../common/types';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  tokenType: 'Bearer';
}

/**
 * Emite y revoca los pares access/refresh.
 * Los refresh tokens vigentes viven en Redis, así que cerrar sesión los invalida
 * de inmediato en todas las instancias del backend.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly authState: AuthStateService,
  ) {}

  private ttlToSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!match) return 60 * 60 * 24 * 30;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * multipliers[unit];
  }

  get refreshTtlSeconds(): number {
    return this.ttlToSeconds(this.config.get<string>('jwt.refreshTtl', '30d'));
  }

  async issue(user: User): Promise<TokenPair> {
    const jti = randomUUID();
    const sv = await this.authState.getSessionVersion(user.id);
    const base: JwtPayload = { sub: user.id, email: user.email, role: user.role, sv };

    const accessTtl = this.config.get<string>('jwt.accessTtl', '15m');
    const refreshTtl = this.config.get<string>('jwt.refreshTtl', '30d');

    const accessToken = await this.jwt.signAsync(
      { ...base, type: 'access' },
      { secret: this.config.get<string>('jwt.accessSecret'), expiresIn: accessTtl as any },
    );
    const refreshToken = await this.jwt.signAsync(
      { ...base, type: 'refresh', jti },
      { secret: this.config.get<string>('jwt.refreshSecret'), expiresIn: refreshTtl as any },
    );

    await this.cache.set(
      CacheService.refreshKey(user.id, jti),
      { issuedAt: Date.now() },
      this.ttlToSeconds(refreshTtl),
    );

    return { accessToken, refreshToken, expiresIn: accessTtl, tokenType: 'Bearer' };
  }

  async verifyRefresh(token: string): Promise<JwtPayload> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('El refresh token no es válido o ya expiró');
    }
    if (payload.type !== 'refresh' || !payload.jti) {
      throw new UnauthorizedException('Tipo de token inválido');
    }
    const stored = await this.cache.get(CacheService.refreshKey(payload.sub, payload.jti));
    if (!stored) throw new UnauthorizedException('La sesión ya fue cerrada');
    return payload;
  }

  async revoke(userId: string, jti: string): Promise<void> {
    await this.cache.del(CacheService.refreshKey(userId, jti));
  }

  /**
   * Cierra todas las sesiones: borra los refresh tokens y marca como inválidos
   * los access tokens ya emitidos (el JwtAuthGuard los rechaza desde ya).
   */
  async revokeAll(userId: string): Promise<void> {
    await this.authState.bumpSessionVersion(userId);
    await this.cache.delByPattern(`refresh:${userId}:*`);
  }
}
