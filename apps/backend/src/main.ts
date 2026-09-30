import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyCookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import configuration from './config/configuration';
import { runSeed } from './database/seeds/seed-data';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const early = configuration();
  // Un numero N confia en los N saltos mas cercanos (nginx = 1)
  const trustProxy =
    typeof early.trustProxy === 'number'
      ? (_address: string, hop: number) => hop < (early.trustProxy as number)
      : early.trustProxy;

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // trustProxy: solo nginx (1 salto) puede fijar X-Forwarded-For; asi la IP que
    // usa el rate limiting no se puede falsear desde el cliente.
    new FastifyAdapter({ trustProxy, bodyLimit: early.bodyLimit }),
    { bufferLogs: false },
  );

  const config = app.get(ConfigService);
  const prefix = config.get<string>('apiPrefix', 'api');
  const port = config.get<number>('port', 3000);
  const origins = config.get<string[]>('corsOrigins', []);
  const swaggerEnabled = config.get<boolean>('swaggerEnabled', false);

  await app.register(fastifyCookie as any);
  await app.register(helmet as any, {
    // Swagger UI necesita estilos y scripts en linea; la API pura no sirve HTML
    contentSecurityPolicy: swaggerEnabled
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        }
      : { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });

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
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Auth-Client',
      'X-App-Version',
      'X-App-Platform',
    ],
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

  // ── Documentacion OpenAPI (desactivada por defecto en produccion) ────
  if (swaggerEnabled) {
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
  }

  // ── Datos de demostracion (nunca en produccion) ──────────────────────
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
  if (swaggerEnabled) logger.log(`Documentacion en http://0.0.0.0:${port}/${prefix}/docs`);
}

void bootstrap();
