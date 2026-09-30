import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Capa de cache sobre Redis.
 *
 * Se usa para:
 *  - cachear el detalle de una lista (`list:<id>:detail`)
 *  - guardar los refresh tokens vigentes (`refresh:<userId>:<jti>`)
 *  - guardar el `state` de los flujos OAuth (`oauth:state:<state>`)
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) public readonly client: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      this.logger.warn(`No se pudo leer la clave ${key}: ${(error as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(`No se pudo escribir la clave ${key}: ${(error as Error).message}`);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (!keys.length) return;
    try {
      await this.client.del(...keys);
    } catch (error) {
      this.logger.warn(`No se pudieron borrar las claves: ${(error as Error).message}`);
    }
  }

  /** Borra por patron usando SCAN para no bloquear Redis */
  async delByPattern(pattern: string): Promise<void> {
    let cursor = '0';
    do {
      const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = next;
      if (keys.length) await this.client.del(...keys);
    } while (cursor !== '0');
  }

  /** Lee de cache y, si no existe, ejecuta el productor y guarda el resultado */
  async wrap<T>(key: string, ttlSeconds: number, producer: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await producer();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  // ── Claves bien conocidas ──────────────────────────────────────────
  static listDetailKey(listId: string): string {
    return `list:${listId}:detail`;
  }

  static userListsKey(userId: string): string {
    return `user:${userId}:lists`;
  }

  static refreshKey(userId: string, jti: string): string {
    return `refresh:${userId}:${jti}`;
  }

  static oauthStateKey(state: string): string {
    return `oauth:state:${state}`;
  }
}
