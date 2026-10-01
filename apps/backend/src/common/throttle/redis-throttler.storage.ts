import { Inject, Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.constants';

/**
 * Contador de ventana fija + bloqueo, atómico en Redis.
 * KEYS[1] = contador, KEYS[2] = marca de bloqueo.
 * ARGV    = ttl (ms), límite, duración del bloqueo (ms).
 * Devuelve {hits, ttl restante (ms), bloqueado (0/1), bloqueo restante (ms)}.
 */
const INCREMENT_SCRIPT = `
local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl > 0 then
  local hits = tonumber(redis.call('GET', KEYS[1]) or '0')
  return {hits, redis.call('PTTL', KEYS[1]), 1, blockTtl}
end
local hits = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
if hits > tonumber(ARGV[2]) then
  local block = tonumber(ARGV[3])
  if block <= 0 then block = ttl end
  redis.call('SET', KEYS[2], '1', 'PX', block)
  return {hits, ttl, 1, block}
end
return {hits, ttl, 0, 0}
`;

/**
 * Almacén del rate limiting en Redis: los contadores se comparten entre todas
 * las réplicas del backend y sobreviven a un reinicio del contenedor.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const base = `throttle:${throttlerName}:${key}`;
    const [hits, ttlMs, blocked, blockMs] = (await this.redis.eval(
      INCREMENT_SCRIPT,
      2,
      base,
      `${base}:blocked`,
      ttl,
      limit,
      blockDuration,
    )) as [number, number, number, number];

    return {
      totalHits: hits,
      timeToExpire: Math.max(0, Math.ceil(ttlMs / 1000)),
      isBlocked: blocked === 1,
      timeToBlockExpire: Math.max(0, Math.ceil(blockMs / 1000)),
    };
  }
}
