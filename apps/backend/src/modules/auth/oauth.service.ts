import { BadRequestException, Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose';
import { CacheService } from '../../redis/cache.service';

export interface SocialProfile {
  provider: 'google' | 'apple';
  providerId: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  emailVerified: boolean;
}

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

const APPLE_AUTH_URL = 'https://appleid.apple.com/auth/authorize';
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';

/**
 * Inicio de sesion con Google y con Apple.
 *
 * Se implementa directamente contra los endpoints OIDC de cada proveedor
 * (sin passport) para poder usar el mismo codigo desde la web (flujo con
 * redireccion) y desde la app movil (flujo con id_token nativo).
 */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private readonly googleJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  private readonly appleJwks = createRemoteJWKSet(new URL(APPLE_JWKS_URL));

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {}

  get googleEnabled(): boolean {
    return this.config.get<boolean>('google.enabled', false);
  }

  get appleEnabled(): boolean {
    return this.config.get<boolean>('apple.enabled', false);
  }

  providers() {
    return { google: this.googleEnabled, apple: this.appleEnabled, local: true };
  }

  // ── State anti-CSRF compartido por ambos flujos ──────────────────────
  private async createState(returnTo?: string): Promise<string> {
    const state = randomBytes(24).toString('hex');
    await this.cache.set(CacheService.oauthStateKey(state), { returnTo: returnTo ?? null }, 600);
    return state;
  }

  private async consumeState(state: string): Promise<{ returnTo: string | null }> {
    const key = CacheService.oauthStateKey(state);
    const stored = await this.cache.get<{ returnTo: string | null }>(key);
    if (!stored) throw new BadRequestException('El parametro state no es valido o ya expiro');
    await this.cache.del(key);
    return stored;
  }

  // ─────────────────────────────── Google ──────────────────────────────
  async buildGoogleAuthUrl(returnTo?: string): Promise<string> {
    if (!this.googleEnabled) {
      throw new NotImplementedException(
        'El inicio de sesion con Google no esta configurado (define GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET)',
      );
    }
    const state = await this.createState(returnTo);
    const params = new URLSearchParams({
      client_id: this.config.get<string>('google.clientId', ''),
      redirect_uri: this.config.get<string>('google.callbackUrl', ''),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'select_account',
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async handleGoogleCallback(code: string, state: string) {
    const { returnTo } = await this.consumeState(state);

    const body = new URLSearchParams({
      code,
      client_id: this.config.get<string>('google.clientId', ''),
      client_secret: this.config.get<string>('google.clientSecret', ''),
      redirect_uri: this.config.get<string>('google.callbackUrl', ''),
      grant_type: 'authorization_code',
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) {
      this.logger.error(`Google rechazo el intercambio de codigo: ${await response.text()}`);
      throw new BadRequestException('No fue posible completar el inicio de sesion con Google');
    }
    const tokens = (await response.json()) as { id_token?: string };
    if (!tokens.id_token) throw new BadRequestException('Google no devolvio un id_token');

    return { profile: await this.verifyGoogleIdToken(tokens.id_token), returnTo };
  }

  async verifyGoogleIdToken(idToken: string): Promise<SocialProfile> {
    if (!this.config.get<string>('google.clientId')) {
      throw new NotImplementedException('El inicio de sesion con Google no esta configurado');
    }
    try {
      const { payload } = await jwtVerify(idToken, this.googleJwks, {
        issuer: GOOGLE_ISSUERS,
        audience: this.config.get<string>('google.clientId', ''),
      });
      const email = payload.email as string | undefined;
      if (!email) throw new BadRequestException('La cuenta de Google no expone un correo electronico');
      return {
        provider: 'google',
        providerId: String(payload.sub),
        email,
        fullName: (payload.name as string) ?? email.split('@')[0],
        avatarUrl: (payload.picture as string) ?? null,
        emailVerified: Boolean(payload.email_verified),
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotImplementedException) throw error;
      this.logger.warn(`id_token de Google invalido: ${(error as Error).message}`);
      throw new BadRequestException('El token de Google no es valido');
    }
  }

  // ──────────────────────────────── Apple ──────────────────────────────
  async buildAppleAuthUrl(returnTo?: string): Promise<string> {
    if (!this.appleEnabled) {
      throw new NotImplementedException(
        'Sign in with Apple no esta configurado (define APPLE_CLIENT_ID, APPLE_TEAM_ID y APPLE_KEY_ID)',
      );
    }
    const state = await this.createState(returnTo);
    const params = new URLSearchParams({
      client_id: this.config.get<string>('apple.clientId', ''),
      redirect_uri: this.config.get<string>('apple.callbackUrl', ''),
      response_type: 'code id_token',
      scope: 'name email',
      response_mode: 'form_post',
      state,
    });
    return `${APPLE_AUTH_URL}?${params.toString()}`;
  }

  /** Apple exige un client_secret que es en realidad un JWT ES256 de corta vida */
  private async buildAppleClientSecret(): Promise<string> {
    const privateKeyPem = this.config.get<string>('apple.privateKey', '');
    if (!privateKeyPem) throw new NotImplementedException('Falta APPLE_PRIVATE_KEY');
    const key = await importPKCS8(privateKeyPem, 'ES256');
    return new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: this.config.get<string>('apple.keyId', '') })
      .setIssuer(this.config.get<string>('apple.teamId', ''))
      .setIssuedAt()
      .setExpirationTime('10m')
      .setAudience(APPLE_ISSUER)
      .setSubject(this.config.get<string>('apple.clientId', ''))
      .sign(key);
  }

  async handleAppleCallback(input: {
    code?: string;
    idToken?: string;
    state: string;
    user?: string;
  }) {
    const { returnTo } = await this.consumeState(input.state);

    let identityToken = input.idToken;
    if (!identityToken && input.code) {
      const body = new URLSearchParams({
        code: input.code,
        client_id: this.config.get<string>('apple.clientId', ''),
        client_secret: await this.buildAppleClientSecret(),
        redirect_uri: this.config.get<string>('apple.callbackUrl', ''),
        grant_type: 'authorization_code',
      });
      const response = await fetch(APPLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!response.ok) {
        this.logger.error(`Apple rechazo el intercambio de codigo: ${await response.text()}`);
        throw new BadRequestException('No fue posible completar el inicio de sesion con Apple');
      }
      identityToken = ((await response.json()) as { id_token?: string }).id_token;
    }
    if (!identityToken) throw new BadRequestException('Apple no devolvio un identityToken');

    // Apple solo manda el nombre en el PRIMER inicio de sesion, dentro del campo `user`
    let fullNameHint: string | undefined;
    if (input.user) {
      try {
        const parsed = JSON.parse(input.user) as { name?: { firstName?: string; lastName?: string } };
        fullNameHint = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean).join(' ');
      } catch {
        /* payload opcional: si viene mal formado simplemente se ignora */
      }
    }

    const profile = await this.verifyAppleIdentityToken(identityToken, fullNameHint);
    return { profile, returnTo };
  }

  async verifyAppleIdentityToken(identityToken: string, fullNameHint?: string): Promise<SocialProfile> {
    const clientId = this.config.get<string>('apple.clientId', '');
    if (!clientId) throw new NotImplementedException('Sign in with Apple no esta configurado');
    try {
      const { payload } = await jwtVerify(identityToken, this.appleJwks, {
        issuer: APPLE_ISSUER,
        audience: clientId,
      });
      const email = (payload.email as string) ?? `${payload.sub}@privaterelay.appleid.com`;
      return {
        provider: 'apple',
        providerId: String(payload.sub),
        email,
        fullName: fullNameHint?.trim() || email.split('@')[0],
        avatarUrl: null,
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      };
    } catch (error) {
      if (error instanceof NotImplementedException) throw error;
      this.logger.warn(`identityToken de Apple invalido: ${(error as Error).message}`);
      throw new BadRequestException('El token de Apple no es valido');
    }
  }
}
