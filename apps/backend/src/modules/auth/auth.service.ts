import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { AuthProvider, User } from '../../database/entities';
import { UsersService } from '../users/users.service';
import { PublicUser, toPublicUser } from '../users/user.mapper';
import { CacheService } from '../../redis/cache.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { MailService } from '../mail/mail.service';
import {
  mfaChangedTemplate,
  passwordChangedTemplate,
  resetPasswordTemplate,
  socialLinkedTemplate,
  verifyEmailTemplate,
} from '../mail/mail.templates';
import { TokenPair, TokenService } from './token.service';
import { OAuthService, SocialProfile } from './oauth.service';
import { MfaService } from './mfa.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

export interface AuthResult extends TokenPair {
  user: PublicUser;
}

/** Respuesta del login cuando la cuenta tiene activa la verificacion en dos pasos */
export interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string;
}

export type LoginOutcome = AuthResult | MfaChallenge;

export const isMfaChallenge = (outcome: LoginOutcome): outcome is MfaChallenge =>
  'mfaRequired' in outcome;

const INVALID_CREDENTIALS = 'Correo o contrasena incorrectos';
const FORGOT_PASSWORD_MESSAGE =
  'Si el correo esta registrado te enviamos un enlace para restablecer la contrasena.';

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
const newToken = (): string => randomBytes(32).toString('base64url');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Hash de relleno para que "correo inexistente" tarde lo mismo que "clave mala" */
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly oauth: OAuthService,
    private readonly mfa: MfaService,
    private readonly mail: MailService,
    private readonly cache: CacheService,
    private readonly realtime: RealtimeGateway,
    private readonly config: ConfigService,
  ) {}

  private get publicUrl(): string {
    return this.config.get<string>('publicUrl', 'http://localhost:8080');
  }

  // ── Emision de sesiones ──────────────────────────────────────────────
  private async issueSession(user: User): Promise<AuthResult> {
    if (!user.isActive) throw new ForbiddenException('La cuenta esta desactivada');
    await this.users.touchLogin(user.id);
    const pair = await this.tokens.issue(user);
    return { ...pair, user: toPublicUser(user) };
  }

  /** Emite la sesion o, si la cuenta tiene 2FA, un reto que hay que resolver antes */
  private async completeLogin(user: User): Promise<LoginOutcome> {
    if (!user.isActive) throw new ForbiddenException('La cuenta esta desactivada');
    if (user.totpEnabled) {
      return { mfaRequired: true, mfaToken: await this.mfa.createChallenge(user.id) };
    }
    return this.issueSession(user);
  }

  /** Cierra todas las sesiones de un usuario, incluidos sus WebSockets */
  private async endAllSessions(userId: string): Promise<void> {
    await this.tokens.revokeAll(userId);
    await this.realtime.disconnectUser(userId);
  }

  // ── Registro y sesion con correo/contrasena ─────────────────────────
  async register(dto: RegisterDto): Promise<AuthResult> {
    const user = await this.users.create({
      fullName: dto.fullName,
      email: dto.email,
      whatsapp: dto.whatsapp,
      password: dto.password,
      provider: AuthProvider.LOCAL,
    });
    await this.sendVerificationEmail(user);
    return this.issueSession(user);
  }

  async login(dto: LoginDto): Promise<LoginOutcome> {
    const lockMs = this.config.get<number>('rateLimit.loginLockMs', 15 * 60_000);
    const maxFailures = this.config.get<number>('rateLimit.loginMaxFailures', 10);
    const failuresKey = CacheService.loginFailuresKey(dto.email);

    const failures = (await this.cache.get<number>(failuresKey)) ?? 0;
    if (failures >= maxFailures) {
      throw new HttpException(
        'Demasiados intentos fallidos con este correo. Espera unos minutos o restablece tu contrasena.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.users.findByEmail(dto.email, true);
    const valid = user?.passwordHash
      ? await this.users.validatePassword(user, dto.password)
      : await this.burnPasswordCheck(dto.password);

    if (!user || !valid) {
      await this.cache.incrementWithTtl(failuresKey, Math.ceil(lockMs / 1000));
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    await this.cache.del(failuresKey);
    return this.completeLogin(user);
  }

  private async burnPasswordCheck(password: string): Promise<false> {
    this.dummyHash ??= bcrypt.hash('relleno-para-igualar-tiempos', 12);
    await bcrypt.compare(password, await this.dummyHash);
    return false;
  }

  async verifyMfa(mfaToken: string, code: string): Promise<AuthResult> {
    const userId = await this.mfa.resolveChallenge(mfaToken, code);
    return this.issueSession(await this.users.findById(userId));
  }

  async loginWithSocialProfile(profile: SocialProfile, whatsapp?: string): Promise<LoginOutcome> {
    const { user, droppedUnverifiedPassword } = await this.users.resolveSocialLogin({
      provider: profile.provider === 'google' ? AuthProvider.GOOGLE : AuthProvider.APPLE,
      subject: profile.providerId,
      email: profile.email,
      emailVerified: profile.emailVerified,
      syntheticEmail: profile.syntheticEmail,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl ?? null,
      whatsapp: whatsapp ?? null,
    });

    if (droppedUnverifiedPassword) {
      // Alguien pudo registrar este correo con una contrasena antes que su dueno:
      // se cierran sus sesiones y se avisa para que elija una contrasena nueva.
      this.logger.warn(`Se descarto una contrasena sin verificar al vincular ${profile.provider}`);
      await this.endAllSessions(user.id);
      this.mail.sendInBackground(
        user.email,
        socialLinkedTemplate(
          user.fullName,
          profile.provider === 'google' ? 'Google' : 'Apple',
          `${this.publicUrl}/app/forgot-password`,
        ),
      );
    }
    return this.completeLogin(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const payload = await this.tokens.verifyRefresh(refreshToken);
    await this.tokens.revoke(payload.sub, payload.jti!); // rotacion de refresh token
    const user = await this.users.findById(payload.sub);
    return this.issueSession(user);
  }

  async logout(refreshToken?: string, userId?: string): Promise<void> {
    if (refreshToken) {
      try {
        const payload = await this.tokens.verifyRefresh(refreshToken);
        await this.tokens.revoke(payload.sub, payload.jti!);
        return;
      } catch {
        /* token ya invalido: no hay nada que revocar */
      }
    }
    if (userId) await this.tokens.revokeAll(userId);
  }

  async me(userId: string): Promise<PublicUser> {
    const [user, hasPassword] = await Promise.all([
      this.users.findById(userId),
      this.users.hasPassword(userId),
    ]);
    return toPublicUser(user, { hasPassword });
  }

  // ── Verificacion de correo ───────────────────────────────────────────
  private async sendVerificationEmail(user: User): Promise<void> {
    const ttl = this.config.get<number>('auth.emailVerificationTtlSeconds', 24 * 3600);
    const token = newToken();
    await this.cache.set(
      CacheService.emailVerificationKey(hashToken(token)),
      { userId: user.id, email: user.email },
      ttl,
    );
    const url = `${this.publicUrl}/app/verify-email#token=${token}`;
    this.mail.sendInBackground(
      user.email,
      verifyEmailTemplate(user.fullName, url, Math.round(ttl / 3600)),
    );
  }

  async resendVerification(userId: string): Promise<{ ok: true }> {
    const user = await this.users.findById(userId);
    if (user.emailVerified) throw new BadRequestException('Tu correo ya esta verificado');
    await this.sendVerificationEmail(user);
    return { ok: true };
  }

  async verifyEmail(token: string): Promise<{ ok: true; email: string }> {
    const data = await this.cache.take<{ userId: string; email: string }>(
      CacheService.emailVerificationKey(hashToken(token)),
    );
    if (!data) throw new BadRequestException('El enlace no es valido o ya expiro');
    const user = await this.users.findById(data.userId);
    if (user.email !== data.email) throw new BadRequestException('El enlace no es valido o ya expiro');
    await this.users.markEmailVerified(user.id);
    return { ok: true, email: user.email };
  }

  // ── Recuperacion de contrasena ───────────────────────────────────────
  /** Siempre responde lo mismo, exista o no el correo, para no revelar cuentas */
  async forgotPassword(email: string): Promise<{ ok: true; message: string }> {
    const user = await this.users.findByEmail(email);
    if (user?.isActive) {
      const ttl = this.config.get<number>('auth.passwordResetTtlSeconds', 3600);
      const token = newToken();
      const tokenHash = hashToken(token);

      // Un enlace nuevo invalida el anterior
      const previous = await this.cache.get<string>(CacheService.passwordResetUserKey(user.id));
      if (previous) await this.cache.del(CacheService.passwordResetKey(previous));

      await this.cache.set(CacheService.passwordResetKey(tokenHash), { userId: user.id }, ttl);
      await this.cache.set(CacheService.passwordResetUserKey(user.id), tokenHash, ttl);

      const url = `${this.publicUrl}/app/reset-password#token=${token}`;
      this.mail.sendInBackground(
        user.email,
        resetPasswordTemplate(user.fullName, url, Math.round(ttl / 60)),
      );
    }
    return { ok: true, message: FORGOT_PASSWORD_MESSAGE };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ ok: true }> {
    const data = await this.cache.take<{ userId: string }>(
      CacheService.passwordResetKey(hashToken(token)),
    );
    if (!data) throw new BadRequestException('El enlace no es valido o ya expiro');

    const user = await this.users.findById(data.userId);
    await this.users.setPassword(user.id, newPassword);
    // Abrir el enlace del correo demuestra que el correo es suyo
    if (!user.emailVerified) await this.users.markEmailVerified(user.id);
    await this.cache.del(
      CacheService.passwordResetUserKey(user.id),
      CacheService.loginFailuresKey(user.email),
    );
    await this.endAllSessions(user.id);
    this.mail.sendInBackground(
      user.email,
      passwordChangedTemplate(user.fullName, `${this.publicUrl}/app/login`),
    );
    return { ok: true };
  }

  /** Cambio desde "Mi cuenta": cierra las demas sesiones y devuelve un par nuevo */
  async changePassword(
    userId: string,
    currentPassword: string | undefined,
    newPassword: string,
  ): Promise<AuthResult> {
    await this.users.changePassword(userId, currentPassword, newPassword);
    await this.endAllSessions(userId);
    const user = await this.users.findById(userId);
    this.mail.sendInBackground(
      user.email,
      passwordChangedTemplate(user.fullName, `${this.publicUrl}/app/login`),
    );
    return this.issueSession(user);
  }

  // ── Verificacion en dos pasos ────────────────────────────────────────
  async mfaSetup(userId: string) {
    return this.mfa.startSetup(await this.users.findById(userId));
  }

  async mfaEnable(userId: string, code: string) {
    const result = await this.mfa.confirmSetup(userId, code);
    const user = await this.users.findById(userId);
    this.mail.sendInBackground(user.email, mfaChangedTemplate(user.fullName, true));
    return { enabled: true, recoveryCodes: result.recoveryCodes };
  }

  async mfaDisable(userId: string, code: string) {
    if (!(await this.mfa.verifyCode(userId, code))) {
      throw new UnauthorizedException('El codigo no es correcto');
    }
    await this.mfa.disable(userId);
    const user = await this.users.findById(userId);
    this.mail.sendInBackground(user.email, mfaChangedTemplate(user.fullName, false));
    return { enabled: false };
  }

  // ── Redirecciones del flujo OAuth web ────────────────────────────────
  /**
   * Destino al terminar un flujo OAuth. Siempre es la app web propia: el refresh
   * token ya va en la cookie httpOnly y en el fragmento solo viaja el estado (o
   * el reto de 2FA), que no queda en los logs del proxy.
   */
  buildRedirectUrl(outcome: LoginOutcome): string {
    const base = `${this.publicUrl}/app/auth/callback`;
    const fragment = isMfaChallenge(outcome)
      ? new URLSearchParams({ mfaToken: outcome.mfaToken })
      : new URLSearchParams({ status: 'ok' });
    return `${base}#${fragment.toString()}`;
  }

  buildErrorRedirectUrl(message: string): string {
    const base = `${this.publicUrl}/app/auth/callback`;
    return `${base}#${new URLSearchParams({ error: message }).toString()}`;
  }

  providers() {
    return this.oauth.providers();
  }
}
