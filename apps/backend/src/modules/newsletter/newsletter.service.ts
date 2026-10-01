import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NewsletterConfig } from '../../config/configuration';
import { SubscribeNewsletterDto } from './newsletter.dto';

/**
 * Alta en el boletín de Listmonk (instancia de la plataforma, `news.<dominio>`).
 * Se hace desde el backend para no depender del CORS de Listmonk y para que el
 * rate limiting por IP la proteja. La confirmación (doble opt-in) la envía Listmonk.
 */
@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(private readonly config: ConfigService) {}

  private get settings(): NewsletterConfig {
    return this.config.get<NewsletterConfig>('newsletter')!;
  }

  get enabled(): boolean {
    return this.settings.enabled;
  }

  async subscribe(dto: SubscribeNewsletterDto): Promise<void> {
    const { listmonkUrl, listUuid } = this.settings;
    if (!this.enabled) {
      throw new ServiceUnavailableException('La suscripción al boletín no está disponible');
    }
    const email = dto.email.trim().toLowerCase();
    // Listmonk exige un nombre: sin él se usa la parte local del correo
    const name = dto.name?.trim() || email.split('@')[0];

    let response: Response;
    try {
      response = await fetch(`${listmonkUrl}/api/public/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, list_uuids: [listUuid] }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      this.logger.error(`Listmonk no respondió: ${(error as Error).message}`);
      throw new BadGatewayException('No se pudo completar la suscripción. Inténtalo más tarde.');
    }
    if (!response.ok) {
      this.logger.error(`Listmonk rechazó la suscripción (${response.status}): ${await response.text()}`);
      throw new BadGatewayException('No se pudo completar la suscripción. Inténtalo más tarde.');
    }
  }
}
