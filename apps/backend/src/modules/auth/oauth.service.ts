import { BadRequestException, Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose';
import { CacheService } from '../../redis/cache.service';

export interface SocialProfile {
  provider: 'google' | 'apple';
  providerId: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  emailVerified: boolean;
  /** El correo lo generamos nosotros porque el proveedor no envió ninguno */
  syntheticEmail?: boolean;
}

interface OAuthState {
  provider: 'google' | 'apple';
  nonce: string;
  codeVerifier?: string;
}

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

const APPLE_AUTH_URL = 'https://appleid.apple.com/auth/authorize';
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';
const APPLE_ISSUER = 'https://appleid.apple.com';

const STATE_TTL_SECONDS = 600;

const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');
const sha256Base64Url = (value: string): string =>
  createHash('sha256').update(value).digest('base64url');

/**
 * Inicio de sesión con Google y con Apple.
 *
 * Se implementa directamente contra los endpoints OIDC de cada proveedor
 * (sin passport) para poder usar el mismo código desde la web (flujo con
 * redirección) y desde la app móvil (flujo con id_token nativo).
 *
 * Flujo web: `state` de un solo uso (anti-CSRF), `nonce` ligado al id_token
 * (anti-repetición) y PKCE S256 en Google. Al terminar siempre se vuelve a la
 * app web propia: no se acepta ninguna URL de retorno del cliente.
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
  private async createState(data: OAuthState): Promise<string> {
    const state = randomToken(24);
    await this.cache.set(CacheService.oauthStateKey(state), data, STATE_TTL_SECONDS);
    return state;
  }

  private async consumeState(state: string, provider: OAuthState['provider']): Promise<OAuthState> {
    const stored = await this.cache.take<OAuthState>(CacheService.oauthStateKey(state));
    if (!stored || stored.provider !== provider) {
      throw new BadRequestException('El parámetro state no es válido o ya expiró');
    }
    return stored;
  }

  // ─────────────────────────────── Google ──────────────────────────────
  async buildGoogleAuthUrl(): Promise<string> {
    if (!this.googleEnabled) {
      throw new NotImplementedException(
        'El inicio de sesión con Google no está configurado (define GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET)',
      );
    }
    const nonce = randomToken();
    const codeVerifier = randomToken(48);
    const state = await this.createState({ provider: 'google', nonce, codeVerifier });
    const params = new URLSearchParams({
      client_id: this.config.get<string>('google.clientId', ''),
      redirect_uri: this.config.get<string>('google.callbackUrl', ''),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: sha256Base64Url(codeVerifier),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async handleGoogleCallback(code: string, state: string): Promise<SocialProfile> {
    const stored = await this.consumeState(state, 'google');

    const body = new URLSearchParams({
      code,
      client_id: this.config.get<string>('google.clientId', ''),
      client_secret: this.config.get<string>('google.clientSecret', ''),
      redirect_uri: this.config.get<string>('google.callbackUrl', ''),
      grant_type: 'authorization_code',
      code_verifier: stored.codeVerifier ?? '',
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) {
      this.logger.error(`Google rechazó el intercambio de código: ${await response.text()}`);
      throw new BadRequestException('No fue posible completar el inicio de sesión con Google');
    }
    const tokens = (await response.json()) as { id_token?: string };
    if (!tokens.id_token) throw new BadRequestException('Google no devolvió un id_token');

    return this.verifyGoogleIdToken(tokens.id_token, stored.nonce);
  }

  /**
   * Verifica un id_token de Google. Acepta como audiencia el client_id web y los
   * de iOS/Android (`GOOGLE_ALLOWED_AUDIENCES`), porque el SDK nativo emite el
   * token para el client_id de la plataforma.
   */
  async verifyGoogleIdToken(idToken: string, expectedNonce?: string): Promise<SocialProfile> {
    const audiences = this.config.get<string[]>('google.allowedAudiences', []);
    if (!audiences.length) {
      throw new NotImplementedException('El inicio de sesión con Google no está configurado');
    }
    try {
      const { payload } = await jwtVerify(idToken, this.googleJwks, {
        issuer: GOOGLE_ISSUERS,
        audience: audiences,
      });
      if (expectedNonce !== undefined && payload.nonce !== expectedNonce) {
        throw new BadRequestException('El token de Google no corresponde a este inicio de sesión');
      }
      const email = payload.email as string | undefined;
      if (!email) throw new BadRequestException('La cuenta de Google no expone un correo electrónico');
      return {
        provider: 'google',
        providerId: String(payload.sub),
        email,
        fullName: (payload.name as string) ?? email.split('@')[0],
        avatarUrl: (payload.picture as string) ?? null,
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotImplementedException) throw error;
      this.logger.warn(`id_token de Google inválido: ${(error as Error).message}`);
      throw new BadRequestException('El token de Google no es válido');
    }
  }

  // ──────────────────────────────── Apple ──────────────────────────────
  async buildAppleAuthUrl(): Promise<string> {
    if (!this.appleEnabled) {
      throw new NotImplementedException(
        'Sign in with Apple no está configurado (define APPLE_CLIENT_ID, APPLE_TEAM_ID y APPLE_KEY_ID)',
      );
    }
    const nonce = randomToken();
    const state = await this.createState({ provider: 'apple', nonce });
    const params = new URLSearchParams({
      client_id: this.config.get<string>('apple.clientId', ''),
      redirect_uri: this.config.get<string>('apple.callbackUrl', ''),
      response_type: 'code id_token',
      scope: 'name email',
      response_mode: 'form_post',
      state,
      nonce,
    });
    return `${APPLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Apple exige un client_secret que es en realidad un JWT ES256 de corta vida.
   * Su `sub` es el client_id: el Service ID en la web y el bundle id en la app nativa.
   */
  private async buildAppleClientSecret(
    clientId = this.config.get<string>('apple.clientId', ''),
  ): Promise<string> {
    const privateKeyPem = this.config.get<string>('apple.privateKey', '');
    if (!privateKeyPem) throw new NotImplementedException('Falta APPLE_PRIVATE_KEY');
    const key = await importPKCS8(privateKeyPem, 'ES256');
    return new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: this.config.get<string>('apple.keyId', '') })
      .setIssuer(this.config.get<string>('apple.teamId', ''))
      .setIssuedAt()
      .setExpirationTime('10m')
      .setAudience(APPLE_ISSUER)
      .setSubject(clientId)
      .sign(key);
  }

  /**
   * Revoca los tokens de Sign in with Apple al borrar una cuenta, como pide Apple.
   * No guardamos tokens de Apple, así que la app de iOS manda un authorizationCode
   * recién emitido: se canjea por un refresh token y ese se revoca. Solo se revoca si
   * el código pertenece al `sub` de la cuenta que se borra. Devuelve si lo logró.
   */
  async revokeAppleAuthorization(code: string, expectedSubject: string): Promise<boolean> {
    if (!this.config.get<string>('apple.privateKey', '')) return false;
    const clientId = this.config.get<string>('apple.bundleId', '');
    try {
      const clientSecret = await this.buildAppleClientSecret(clientId);
      const exchange = await fetch(APPLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
        }),
      });
      if (!exchange.ok) {
        this.logger.warn(`Apple rechazó el código para revocar: ${await exchange.text()}`);
        return false;
      }
      const tokens = (await exchange.json()) as { refresh_token?: string; id_token?: string };
      if (!tokens.refresh_token || !tokens.id_token) return false;

      const { payload } = await jwtVerify(tokens.id_token, this.appleJwks, {
        issuer: APPLE_ISSUER,
        audience: clientId,
      });
      if (payload.sub !== expectedSubject) {
        this.logger.warn('El código de Apple para revocar no corresponde a la cuenta que se borra');
        return false;
      }

      const revoke = await fetch(APPLE_REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          token: tokens.refresh_token,
          token_type_hint: 'refresh_token',
        }),
      });
      if (!revoke.ok) this.logger.warn(`Apple no revocó el token: ${await revoke.text()}`);
      return revoke.ok;
    } catch (error) {
      this.logger.warn(`No se pudo revocar la autorización de Apple: ${(error as Error).message}`);
      return false;
    }
  }

  async handleAppleCallback(input: {
    code?: string;
    idToken?: string;
    state: string;
    user?: string;
  }): Promise<SocialProfile> {
    const stored = await this.consumeState(input.state, 'apple');

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
        this.logger.error(`Apple rechazó el intercambio de código: ${await response.text()}`);
        throw new BadRequestException('No fue posible completar el inicio de sesión con Apple');
      }
      identityToken = ((await response.json()) as { id_token?: string }).id_token;
    }
    if (!identityToken) throw new BadRequestException('Apple no devolvió un identityToken');

    // Apple solo manda el nombre en el PRIMER inicio de sesión, dentro del campo `user`
    let fullNameHint: string | undefined;
    if (input.user) {
      try {
        const parsed = JSON.parse(input.user) as { name?: { firstName?: string; lastName?: string } };
        fullNameHint = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean).join(' ');
      } catch {
        /* payload opcional: si viene mal formado simplemente se ignora */
      }
    }

    return this.verifyAppleIdentityToken(identityToken, fullNameHint, stored.nonce);
  }

  /**
   * Verifica un identityToken de Apple. La audiencia es el Service ID en la web y
   * el bundle id en la app nativa (`APPLE_ALLOWED_AUDIENCES`).
   */
  async verifyAppleIdentityToken(
    identityToken: string,
    fullNameHint?: string,
    expectedNonce?: string,
  ): Promise<SocialProfile> {
    const audiences = this.config.get<string[]>('apple.allowedAudiences', []);
    if (!audiences.length) throw new NotImplementedException('Sign in with Apple no está configurado');
    try {
      const { payload } = await jwtVerify(identityToken, this.appleJwks, {
        issuer: APPLE_ISSUER,
        audience: audiences,
      });
      if (expectedNonce !== undefined && payload.nonce !== expectedNonce) {
        throw new BadRequestException('El token de Apple no corresponde a este inicio de sesión');
      }
      const realEmail = payload.email as string | undefined;
      const email = realEmail ?? `${payload.sub}@privaterelay.appleid.com`;
      return {
        provider: 'apple',
        providerId: String(payload.sub),
        email,
        fullName: fullNameHint?.trim() || email.split('@')[0],
        avatarUrl: null,
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
        syntheticEmail: !realEmail,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotImplementedException) throw error;
      this.logger.warn(`identityToken de Apple inválido: ${(error as Error).message}`);
      throw new BadRequestException('El token de Apple no es válido');
    }
  }
}
