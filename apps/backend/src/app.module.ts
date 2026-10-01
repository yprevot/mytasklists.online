import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration, { RateLimitConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import * as entities from './database/entities';
import { MIGRATIONS } from './database/migrations';
import type Redis from 'ioredis';
import { RedisModule } from './redis/redis.module';
import { REDIS_CLIENT } from './redis/redis.constants';
import { MailModule } from './modules/mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ListsModule } from './modules/lists/lists.module';
import { ItemsModule } from './modules/items/items.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RecurrenceModule } from './modules/recurrence/recurrence.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';
import { CompatModule } from './modules/compat/compat.module';
import { NewsletterModule } from './modules/newsletter/newsletter.module';
import { AppVersionGuard } from './common/guards/app-version.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppThrottlerGuard } from './common/throttle/app-throttler.guard';
import { RedisThrottlerStorage } from './common/throttle/redis-throttler.storage';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      cache: true,
      validate: validateEnv,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.database'),
        entities: Object.values(entities).filter((value) => typeof value === 'function') as any[],
        migrations: MIGRATIONS,
        migrationsRun: config.get<boolean>('database.runMigrations', true),
        synchronize: false,
        autoLoadEntities: false,
        retryAttempts: 15,
        retryDelay: 3000,
        logging: ['error', 'warn'] as any,
      }),
    }),

    ScheduleModule.forRoot(),
    RedisModule,
    MailModule,

    // Rate limiting global por IP, con los contadores en Redis
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (config: ConfigService, redis: Redis) => {
        const limits = config.get<RateLimitConfig>('rateLimit')!;
        return {
          throttlers: [{ name: 'default', limit: limits.globalLimit, ttl: limits.globalTtlMs }],
          storage: new RedisThrottlerStorage(redis),
          skipIf: () => !limits.enabled,
        };
      },
    }),

    // Módulos de dominio
    RealtimeModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    ListsModule,
    ItemsModule,
    RecurrenceModule,
    AdminModule,
    HealthModule,
    CompatModule,
    NewsletterModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: AppVersionGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
