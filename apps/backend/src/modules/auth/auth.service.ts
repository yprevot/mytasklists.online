import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider, User } from '../../database/entities';
import { UsersService } from '../users/users.service';
import { PublicUser, toPublicUser } from '../users/user.mapper';
import { TokenPair, TokenService } from './token.service';
import { OAuthService, SocialProfile } from './oauth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

export interface AuthResult extends TokenPair {
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly oauth: OAuthService,
    private readonly config: ConfigService,
  ) {}

  private async buildResult(user: User): Promise<AuthResult> {
    if (!user.isActive) throw new ForbiddenException('La cuenta esta desactivada');
    await this.users.touchLogin(user.id);
    const pair = await this.tokens.issue(user);
    return { ...pair, user: toPublicUser(user) };
  }

  async register(dto: RegisterDto): Promise<AuthResult> {
    const user = await this.users.create({
      fullName: dto.fullName,
      email: dto.email,
      whatsapp: dto.whatsapp,
      password: dto.password,
      provider: AuthProvider.LOCAL,
    });
    return this.buildResult(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findByEmail(dto.email, true);
    if (!user) throw new UnauthorizedException('Correo o contrasena incorrectos');

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        `Esta cuenta se creo con ${user.provider}. Inicia sesion con ese metodo o define una contrasena.`,
      );
    }
    const valid = await this.users.validatePassword(user, dto.password);
    if (!valid) throw new UnauthorizedException('Correo o contrasena incorrectos');

    return this.buildResult(user);
  }

  async loginWithSocialProfile(profile: SocialProfile, whatsapp?: string): Promise<AuthResult> {
    const user = await this.users.findOrCreateFromProvider({
      fullName: profile.fullName,
      email: profile.email,
      avatarUrl: profile.avatarUrl ?? null,
      provider: profile.provider === 'google' ? AuthProvider.GOOGLE : AuthProvider.APPLE,
      providerId: profile.providerId,
      whatsapp: whatsapp ?? null,
      emailVerified: profile.emailVerified,
    });
    return this.buildResult(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const payload = await this.tokens.verifyRefresh(refreshToken);
    await this.tokens.revoke(payload.sub, payload.jti!); // rotacion de refresh token
    const user = await this.users.findById(payload.sub);
    return this.buildResult(user);
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
    return toPublicUser(await this.users.findById(userId));
  }

  /**
   * URL a la que se devuelve al navegador al terminar un flujo OAuth.
   * Los tokens viajan en el fragmento (#) para que no queden en los logs del proxy.
   */
  buildRedirectUrl(result: AuthResult, returnTo?: string | null): string {
    const base = returnTo ?? `${this.config.get<string>('publicUrl')}/app/auth/callback`;
    const fragment = new URLSearchParams({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    return `${base}#${fragment.toString()}`;
  }

  buildErrorRedirectUrl(message: string): string {
    const base = `${this.config.get<string>('publicUrl')}/app/auth/callback`;
    return `${base}#${new URLSearchParams({ error: message }).toString()}`;
  }

  providers() {
    return this.oauth.providers();
  }
}
