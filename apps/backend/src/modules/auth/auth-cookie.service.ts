import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import '@fastify/cookie';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Clientes web que guardan el refresh token en una cookie httpOnly en vez de en
 * localStorage (inaccesible para JavaScript, asi un XSS no puede robarlo).
 * Cada SPA usa su propia cookie para que entrar al panel no inicie sesion en la
 * app y viceversa. La app movil y los clientes de API siguen usando el cuerpo.
 */
const COOKIE_BY_CLIENT = {
  web: 'lc_rt',
  dashboard: 'lc_dash_rt',
} as const;

export type CookieClient = keyof typeof COOKIE_BY_CLIENT;
export const AUTH_CLIENT_HEADER = 'x-auth-client';

@Injectable()
export class AuthCookieService {
  constructor(private readonly config: ConfigService) {}

  /** Cliente web que hizo la peticion, segun la cabecera `X-Auth-Client` */
  clientOf(request: FastifyRequest): CookieClient | null {
    const value = String(request.headers[AUTH_CLIENT_HEADER] ?? '').toLowerCase();
    return value in COOKIE_BY_CLIENT ? (value as CookieClient) : null;
  }

  private get path(): string {
    return `/${this.config.get<string>('apiPrefix', 'api')}/auth`;
  }

  read(request: FastifyRequest, client: CookieClient): string | undefined {
    return (request.cookies as Record<string, string | undefined> | undefined)?.[COOKIE_BY_CLIENT[client]];
  }

  write(reply: FastifyReply, client: CookieClient, refreshToken: string, maxAgeSeconds: number): void {
    reply.setCookie(COOKIE_BY_CLIENT[client], refreshToken, {
      httpOnly: true,
      secure: this.config.get<boolean>('auth.cookieSecure', false),
      sameSite: 'strict',
      path: this.path,
      maxAge: maxAgeSeconds,
    });
  }

  clear(reply: FastifyReply, client: CookieClient): void {
    reply.clearCookie(COOKIE_BY_CLIENT[client], { path: this.path });
  }
}
