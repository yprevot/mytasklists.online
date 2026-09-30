import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT, REDIS_SUBSCRIBER } from './redis.constants';
import { CacheService } from './cache.service';

const buildClient = (config: ConfigService): Redis =>
  new Redis({
    host: config.get<string>('redis.host', 'redis'),
    port: config.get<number>('redis.port', 6379),
    password: config.get<string>('redis.password') || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });

@Global()
@Module({
  providers: [
    { provide: REDIS_CLIENT, inject: [ConfigService], useFactory: buildClient },
    { provide: REDIS_SUBSCRIBER, inject: [ConfigService], useFactory: buildClient },
    CacheService,
  ],
  exports: [REDIS_CLIENT, REDIS_SUBSCRIBER, CacheService],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(private readonly cache: CacheService) {}

  async onApplicationShutdown(): Promise<void> {
    await this.cache.disconnect();
  }
}
