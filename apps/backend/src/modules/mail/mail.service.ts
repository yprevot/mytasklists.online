import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { MailContent } from './mail.templates';

/**
 * Envío de correo transaccional por SMTP.
 *
 * - En desarrollo el docker-compose apunta a Mailpit (http://localhost:8025).
 * - En producción sirve cualquier SMTP: Amazon SES, Resend, Postmark, SendGrid…
 * - Si no hay SMTP configurado el correo se escribe en el log, para no bloquear
 *   el registro en una instalación local sin correo.
 */
@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.from = config.get<string>('mail.from', 'MyTaskLists <no-responder@localhost>');
    if (!config.get<boolean>('mail.enabled', false)) {
      this.transporter = null;
      this.logger.warn('SMTP_HOST no está definido: los correos solo se escribirán en el log');
      return;
    }
    const user = config.get<string>('mail.user');
    this.transporter = createTransport({
      host: config.get<string>('mail.host'),
      port: config.get<number>('mail.port', 587),
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000,
      secure: config.get<boolean>('mail.secure', false),
      auth: user ? { user, pass: config.get<string>('mail.password') } : undefined,
    });
  }

  assertConfigured(): void {
    if (!this.transporter) throw new ServiceUnavailableException('El servicio de correo no está disponible. Inténtalo más tarde.');
  }

  async assertAvailable(): Promise<void> {
    if (!this.transporter) throw new ServiceUnavailableException('El servicio de correo no está disponible. Inténtalo más tarde.');
    try { await this.transporter.verify(); }
    catch { throw new ServiceUnavailableException('El servicio de correo no está disponible. Inténtalo más tarde.'); }
  }

  async send(to: string, content: MailContent): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`Correo no enviado: SMTP no configurado`);
      return;
    }
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
  }

  /** Envío en segundo plano: un fallo del SMTP nunca debe tumbar la petición */
  sendInBackground(to: string, content: MailContent): void {
    this.send(to, content).catch((error) =>
      this.logger.error('No se pudo enviar correo transaccional'),
    );
  }

  onModuleDestroy(): void {
    this.transporter?.close();
  }
}
