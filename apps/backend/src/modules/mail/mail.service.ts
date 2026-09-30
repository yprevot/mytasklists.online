import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { MailContent } from './mail.templates';

/**
 * Envio de correo transaccional por SMTP.
 *
 * - En desarrollo el docker-compose apunta a Mailpit (http://localhost:8025).
 * - En produccion sirve cualquier SMTP: Amazon SES, Resend, Postmark, SendGrid…
 * - Si no hay SMTP configurado el correo se escribe en el log, para no bloquear
 *   el registro en una instalacion local sin correo.
 */
@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.from = config.get<string>('mail.from', 'ListaDeCompras <no-responder@localhost>');
    if (!config.get<boolean>('mail.enabled', false)) {
      this.transporter = null;
      this.logger.warn('SMTP_HOST no esta definido: los correos solo se escribiran en el log');
      return;
    }
    const user = config.get<string>('mail.user');
    this.transporter = createTransport({
      host: config.get<string>('mail.host'),
      port: config.get<number>('mail.port', 587),
      secure: config.get<boolean>('mail.secure', false),
      auth: user ? { user, pass: config.get<string>('mail.password') } : undefined,
    });
  }

  async send(to: string, content: MailContent): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[correo sin enviar] para=${to} asunto="${content.subject}"\n${content.text}`);
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

  /** Envio en segundo plano: un fallo del SMTP nunca debe tumbar la peticion */
  sendInBackground(to: string, content: MailContent): void {
    this.send(to, content).catch((error) =>
      this.logger.error(`No se pudo enviar "${content.subject}": ${(error as Error).message}`),
    );
  }

  onModuleDestroy(): void {
    this.transporter?.close();
  }
}
