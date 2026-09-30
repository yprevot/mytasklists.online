import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { runSeed } from './database/seeds/seed-data';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 10 * 1024 * 1024 }),
    { bufferLogs: false },
  );

  const config = app.get(ConfigService);
  const prefix = config.get<string>('apiPrefix', 'api');
  const port = config.get<number>('port', 3000);
  const origins = config.get<string[]>('corsOrigins', []);

  // El callback de Apple llega como application/x-www-form-urlencoded; el
  // adaptador de Fastify de Nest ya registra ese parser por si solo.
  app.setGlobalPrefix(prefix);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || origins.includes(origin) || origins.includes('*')) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableShutdownHooks();

  // ── Documentacion OpenAPI ────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ListaDeCompras API')
    .setDescription(
      'API de listas de compras compartidas con productos recurrentes y sincronizacion en tiempo real.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(`${prefix}/docs`, app, SwaggerModule.createDocument(app, swaggerConfig), {
    jsonDocumentUrl: `${prefix}/docs-json`,
  });

  // ── Datos de demostracion ────────────────────────────────────────────
  if (config.get<boolean>('database.runSeed', false)) {
    try {
      const dataSource = app.get(DataSource);
      const summary = await runSeed(dataSource);
      logger.log(`Seed: ${summary}`);
    } catch (error) {
      logger.error(`No se pudo cargar el seed: ${(error as Error).message}`);
    }
  }

  await app.listen({ port, host: '0.0.0.0' });
  logger.log(`API escuchando en http://0.0.0.0:${port}/${prefix}`);
  logger.log(`Documentacion en http://0.0.0.0:${port}/${prefix}/docs`);
}

void bootstrap();
