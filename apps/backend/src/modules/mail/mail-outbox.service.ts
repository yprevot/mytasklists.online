import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { DataSource, EntityManager } from 'typeorm';
import { MailService } from './mail.service';
import { MailContent } from './mail.templates';
import { decryptSecret, encryptSecret } from '../auth/totp';

/** Transactional delivery. SMTP never runs while a domain transaction is open.
 * At-least-once: a crash after SMTP acceptance may resend the same link, never a new grant.
 */
@Injectable()
export class MailOutboxService {
  private busy = false;
  private readonly logger = new Logger(MailOutboxService.name);
  constructor(private readonly db: DataSource, private readonly mail: MailService, private readonly config: ConfigService) {}

  async enqueue(manager: EntityManager, to: string, content: MailContent,
    kind: 'registration' | 'invitation', reference: string, version: string): Promise<void> {
    this.mail.assertConfigured();
    const payload = encryptSecret(JSON.stringify({ to, content }), this.config.get<string>('encryptionKey')!);
    await manager.query('INSERT INTO mail_outbox(payload,kind,reference,version) VALUES($1,$2,$3,$4)',
      [payload, kind, reference, version]);
  }

  kick(): void { void this.deliver(); }

  @Interval(2000)
  async deliver(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      for (let count = 0; count < 10; count++) {
        const row = await this.db.transaction(async manager => {
          const [job] = await manager.query(`SELECT * FROM mail_outbox WHERE available_at<=now()
            AND (lease_until IS NULL OR lease_until<now()) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`);
          if (job) await manager.query("UPDATE mail_outbox SET lease_until=now()+interval '1 minute' WHERE id=$1", [job.id]);
          return job;
        });
        if (!row) break;
        try {
          const [live] = row.kind === 'registration'
            ? await this.db.query('SELECT email FROM registration_requests WHERE email=$1 AND token_hash=$2 AND expires_at>now() AND consumed_at IS NULL', [row.reference, row.version])
            : await this.db.query("SELECT email FROM list_invitations WHERE id::text=$1 AND token=$2 AND status='pending' AND expires_at>now()", [row.reference, row.version]);
          if (live) {
            const { to, content } = JSON.parse(decryptSecret(row.payload, this.config.get<string>('encryptionKey')!));
            await this.mail.send(to, content);
          }
          await this.db.query('DELETE FROM mail_outbox WHERE id=$1', [row.id]);
        } catch {
          // Bounded retries; encrypted content is purged after a day regardless of validity.
          await this.db.query(`UPDATE mail_outbox SET attempts=attempts+1, lease_until=NULL,
            available_at=now()+($2*interval '1 second') WHERE id=$1`, [row.id, Math.min(3600, 5 * 2 ** Math.min(row.attempts, 10))]);
          this.logger.warn('Correo pendiente de entrega; se reintentará');
        }
      }
      await this.db.query("DELETE FROM invitation_send_events WHERE sent_at<now()-interval '1 day'");
      await this.db.query("DELETE FROM mail_outbox WHERE created_at<now()-interval '1 day'");
    } catch { this.logger.warn('Cola de correo temporalmente no disponible'); }
    finally { this.busy = false; }
  }
}
