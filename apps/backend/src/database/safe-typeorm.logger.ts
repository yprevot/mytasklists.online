import { Logger as NestLogger } from '@nestjs/common';
import type { Logger } from 'typeorm';

/**
 * Logger de TypeORM que nunca escribe los parámetros de las consultas: ahí viajan
 * los nombres de listas y productos, correos y demás datos de las personas. Ante un
 * error deja el mensaje y la consulta con sus marcadores ($1, $2…), suficiente para
 * diagnosticar sin exponer contenido en los logs del servidor.
 */
export class SafeTypeOrmLogger implements Logger {
  private readonly logger = new NestLogger('TypeORM');

  logQuery(): void {
    /* las consultas correctas no se registran */
  }

  logQueryError(error: string | Error, query: string): void {
    const message = typeof error === 'string' ? error : error.message;
    this.logger.error(`${message} · consulta: ${query}`);
  }

  logQuerySlow(time: number, query: string): void {
    this.logger.warn(`Consulta lenta (${time} ms): ${query}`);
  }

  logSchemaBuild(): void {
    /* synchronize está desactivado */
  }

  logMigration(message: string): void {
    this.logger.log(message);
  }

  log(level: 'log' | 'info' | 'warn', message: unknown): void {
    if (level === 'warn') this.logger.warn(String(message));
  }
}
