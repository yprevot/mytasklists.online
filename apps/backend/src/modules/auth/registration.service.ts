import { BadRequestException, HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import type { Locale } from '@lista/contracts';
import { User, AuthProvider } from '../../database/entities';
import { MailService } from '../mail/mail.service';
import { registrationTemplate } from '../mail/mail.templates';
import { CompleteRegistrationDto } from './dto/registration.dto';

const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const invalid = () => new BadRequestException('El enlace no es válido o ya expiró');
@Injectable()
export class RegistrationService {
  constructor(private readonly db: DataSource, private readonly mail: MailService, private readonly config: ConfigService) {}
  async request(email: string, locale: Locale): Promise<{ ok: true; cooldownSeconds: number }> {
    const started = Date.now();
    // Health check applies to every address, including existing accounts.
    await this.mail.assertAvailable();
    const cooldown = Number(process.env.REGISTRATION_COOLDOWN_SECONDS || 60);
    try {
      await this.db.transaction(async m => {
        await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['registration:' + email]);
        await m.query('INSERT INTO registration_requests(email,locale) VALUES ($1,$2) ON CONFLICT DO NOTHING', [email, locale]);
        const [row] = await m.query('SELECT * FROM registration_requests WHERE email=$1 FOR UPDATE', [email]);
        const withinHour = Date.now() - new Date(row.window_start).getTime() < 3600000;
        if (row.last_sent_at && Date.now() - new Date(row.last_sent_at).getTime() < cooldown * 1000)
          throw new HttpException('Espera antes de solicitar otro enlace', 429);
        if (withinHour && row.attempts >= Number(process.env.REGISTRATION_MAX_PER_HOUR || 5))
          throw new HttpException('Demasiadas solicitudes. Inténtalo más tarde.', 429);
        const [exists] = await m.query('SELECT id FROM users WHERE lower(email)=$1', [email]);
        const token = randomBytes(32).toString('base64url');
        const ttl = Number(process.env.REGISTRATION_TTL_SECONDS || 1800);
        if (!exists) {
          const base = this.config.get<string>('publicUrl', 'http://localhost:8080');
          await this.mail.send(email, registrationTemplate(locale, `${base}/app/register/complete#token=${token}`, Math.ceil(ttl / 60)));
        }
        await m.query(`UPDATE registration_requests SET token_hash=$2, locale=$3, expires_at=now()+($4 * interval '1 second'),
          consumed_at=NULL,last_sent_at=now(),window_start=$5,attempts=$6 WHERE email=$1`,
          [email, exists ? null : digest(token), locale, ttl, withinHour ? row.window_start : new Date(), withinHour ? row.attempts + 1 : 1]);
      });
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new ServiceUnavailableException('No se pudo enviar el enlace. Inténtalo de nuevo más tarde.');
    } finally {
      // Common response floor reduces a straightforward account-existence timing signal.
      const remaining = 1500 - (Date.now() - started);
      if (remaining > 0) await new Promise(r => setTimeout(r, remaining));
    }
    return { ok: true, cooldownSeconds: cooldown };
  }
  async validate(token: string): Promise<{ email: string }> {
    const [row] = await this.db.query('SELECT email FROM registration_requests WHERE token_hash=$1 AND expires_at>now() AND consumed_at IS NULL', [digest(token)]);
    if (!row) throw invalid();
    return { email: row.email };
  }
  async complete(dto: CompleteRegistrationDto): Promise<User> {
    if (dto.password !== dto.passwordConfirmation) throw new BadRequestException('Las contraseñas no coinciden');
    if (Buffer.byteLength(dto.password, 'utf8') > 72) throw new BadRequestException('La contraseña no puede superar 72 bytes');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    try {
      return await this.db.transaction(async m => {
        const [row] = await m.query('SELECT * FROM registration_requests WHERE token_hash=$1 FOR UPDATE', [digest(dto.token)]);
        if (!row || row.consumed_at || new Date(row.expires_at).getTime() <= Date.now()) throw invalid();
        const repo = m.getRepository(User);
        if (await repo.createQueryBuilder('u').where('lower(u.email)=:email', { email: row.email }).getOne())
          throw new BadRequestException('Ya existe una cuenta con este correo electrónico');
        const user = await repo.save(repo.create({ email: row.email, fullName: dto.fullName.trim(),
          whatsapp: dto.whatsapp, passwordHash, locale: row.locale, emailVerified: true, provider: AuthProvider.LOCAL }));
        await m.query('UPDATE registration_requests SET consumed_at=now() WHERE email=$1', [row.email]);
        return user;
      });
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new BadRequestException('Ya existe una cuenta con este correo electrónico');
      throw e;
    }
  }
}
