import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

/** Normaliza todas las respuestas de error de la API */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Ocurrio un error inesperado';
    let error = 'InternalServerError';
    // Codigo estable y datos extra para que el cliente reaccione sin leer el texto
    let extra: { code?: unknown; details?: unknown } = {};

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
      } else if (response && typeof response === 'object') {
        const body = response as Record<string, unknown>;
        message = (body.message as string | string[]) ?? exception.message;
        error = (body.error as string) ?? exception.name;
        if (body.code !== undefined) extra = { code: body.code, details: body.details };
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    reply.status(status).send({
      statusCode: status,
      error,
      message,
      ...extra,
      path: request?.url,
      timestamp: new Date().toISOString(),
    });
  }
}
