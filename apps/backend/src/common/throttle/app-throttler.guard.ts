import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate limiting global de la API.
 *
 * La IP sale de `request.ip`, que Fastify calcula a partir de X-Forwarded-For
 * respetando `TRUST_PROXY` (por defecto confía solo en nginx). Solo aplica a
 * HTTP: Socket.IO se autentica en el handshake.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    return context.getType() !== 'http';
  }

  protected async throwThrottlingException(): Promise<void> {
    throw new ThrottlerException('Demasiadas peticiones. Espera un momento y vuelve a intentarlo.');
  }
}
