import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthResult, AuthService, isMfaChallenge, LoginOutcome } from './auth.service';
import { OAuthService } from './oauth.service';
import { AuthCookieService } from './auth-cookie.service';
import { TokenService } from './token.service';
import {
  ForgotPasswordDto,
  LoginDto,
  MfaCodeDto,
  MfaVerifyDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  SocialTokenDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { AuthThrottle, SensitiveThrottle } from '../../common/throttle/throttle-profiles';

/**
 * Los clientes web (app y panel) mandan `X-Auth-Client: web|dashboard`: su
 * refresh token viaja en una cookie httpOnly y nunca en el cuerpo. La app movil
 * y los clientes de API no mandan la cabecera y reciben el par completo.
 */
@ApiTags('autenticacion')
@ApiHeader({
  name: 'X-Auth-Client',
  required: false,
  description: '`web` o `dashboard` para guardar el refresh token en una cookie httpOnly',
})
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly oauth: OAuthService,
    private readonly cookies: AuthCookieService,
    private readonly tokens: TokenService,
  ) {}

  private redirect(reply: FastifyReply, url: string): void {
    reply.header('location', url).code(302).send();
  }

  /** Mueve el refresh token a la cookie cuando el cliente es una de las SPA */
  private respond(request: FastifyRequest, reply: FastifyReply, outcome: LoginOutcome) {
    if (isMfaChallenge(outcome)) return outcome;
    const client = this.cookies.clientOf(request);
    if (!client) return outcome;
    this.cookies.write(reply, client, outcome.refreshToken, this.tokens.refreshTtlSeconds);
    const { refreshToken: _omit, ...rest } = outcome;
    return rest;
  }

  private refreshTokenFrom(request: FastifyRequest, bodyToken?: string): string | undefined {
    if (bodyToken) return bodyToken;
    const client = this.cookies.clientOf(request);
    return client ? this.cookies.read(request, client) : undefined;
  }

  // ── Registro y sesion con correo/contrasena ─────────────────────────
  @Public()
  @AuthThrottle()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registro con nombre, correo, WhatsApp y contrasena' })
  async register(
    @Body() dto: RegisterDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.respond(request, reply, await this.auth.register(dto));
  }

  @Public()
  @AuthThrottle()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Inicio de sesion con correo y contrasena',
    description: 'Si la cuenta tiene 2FA responde `{ mfaRequired, mfaToken }`: continua en /auth/mfa/verify',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.respond(request, reply, await this.auth.login(dto));
  }

  @Public()
  @AuthThrottle()
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Segundo paso del login: codigo TOTP o de recuperacion' })
  async verifyMfa(
    @Body() dto: MfaVerifyDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.respond(request, reply, await this.auth.verifyMfa(dto.mfaToken, dto.code));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renueva el par de tokens (cuerpo o cookie httpOnly)' })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const token = this.refreshTokenFrom(request, dto?.refreshToken);
    if (!token) throw new UnauthorizedException('Falta el refresh token');
    let result: AuthResult;
    try {
      result = await this.auth.refresh(token);
    } catch (error) {
      const client = this.cookies.clientOf(request);
      if (client) this.cookies.clear(reply, client);
      throw error;
    }
    return this.respond(request, reply, result);
  }

  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cierra la sesion actual' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RefreshDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.auth.logout(this.refreshTokenFrom(request, dto?.refreshToken), user.id);
    const client = this.cookies.clientOf(request);
    if (client) this.cookies.clear(reply, client);
    return { ok: true };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Datos del usuario autenticado' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }

  @Public()
  @Get('providers')
  @ApiOperation({ summary: 'Metodos de autenticacion habilitados en esta instalacion' })
  providers() {
    return this.auth.providers();
  }

  // ─────────────────────────── Verificacion de correo ─────────────────
  @Public()
  @SensitiveThrottle()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirma el correo con el token del enlace' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @SensitiveThrottle()
  @Post('verify-email/resend')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reenvia el correo de verificacion' })
  resendVerification(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.resendVerification(user.id);
  }

  // ─────────────────────────── Recuperar contrasena ───────────────────
  @Public()
  @SensitiveThrottle()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Envia un enlace para restablecer la contrasena (respuesta generica)' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @SensitiveThrottle()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Define una contrasena nueva con el token del enlace y cierra todas las sesiones' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }

  // ─────────────────────────── Verificacion en dos pasos ──────────────
  @Post('mfa/setup')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Genera el secreto TOTP (QR) para activar la verificacion en dos pasos' })
  mfaSetup(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.mfaSetup(user.id);
  }

  @AuthThrottle()
  @Post('mfa/enable')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activa 2FA con el primer codigo y devuelve los codigos de recuperacion' })
  mfaEnable(@CurrentUser() user: AuthenticatedUser, @Body() dto: MfaCodeDto) {
    return this.auth.mfaEnable(user.id, dto.code);
  }

  @AuthThrottle()
  @Post('mfa/disable')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desactiva 2FA (pide un codigo valido)' })
  mfaDisable(@CurrentUser() user: AuthenticatedUser, @Body() dto: MfaCodeDto) {
    return this.auth.mfaDisable(user.id, dto.code);
  }

  // ─────────────────────────────── Google ─────────────────────────────
  @Public()
  @AuthThrottle()
  @Get('google')
  @ApiOperation({ summary: 'Inicia el flujo OAuth con Google (web)' })
  async google(@Res() reply: FastifyReply) {
    this.redirect(reply, await this.oauth.buildGoogleAuthUrl());
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'Callback de Google' })
  async googleCallback(
    @Res() reply: FastifyReply,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    if (error || !code || !state) {
      return this.redirect(reply, this.auth.buildErrorRedirectUrl('google_cancelado'));
    }
    try {
      const profile = await this.oauth.handleGoogleCallback(code, state);
      this.finishWebLogin(reply, await this.auth.loginWithSocialProfile(profile));
    } catch (err) {
      this.logger.error(`Fallo el callback de Google: ${(err as Error).message}`);
      this.redirect(reply, this.auth.buildErrorRedirectUrl('google_fallido'));
    }
  }

  @Public()
  @AuthThrottle()
  @Post('google/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicio de sesion con Google desde la app movil (id_token nativo)' })
  async googleToken(
    @Body() dto: SocialTokenDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const profile = await this.oauth.verifyGoogleIdToken(dto.token);
    if (dto.fullName) profile.fullName = dto.fullName;
    return this.respond(request, reply, await this.auth.loginWithSocialProfile(profile, dto.whatsapp));
  }

  // ──────────────────────────────── Apple ─────────────────────────────
  @Public()
  @AuthThrottle()
  @Get('apple')
  @ApiOperation({ summary: 'Inicia el flujo Sign in with Apple (web)' })
  async apple(@Res() reply: FastifyReply) {
    this.redirect(reply, await this.oauth.buildAppleAuthUrl());
  }

  @Public()
  @Post('apple/callback')
  @ApiOperation({ summary: 'Callback de Apple (form_post)' })
  async appleCallback(@Res() reply: FastifyReply, @Req() request: FastifyRequest) {
    const body = (request.body ?? {}) as Record<string, string>;
    if (body.error || !body.state) {
      return this.redirect(reply, this.auth.buildErrorRedirectUrl('apple_cancelado'));
    }
    try {
      const profile = await this.oauth.handleAppleCallback({
        code: body.code,
        idToken: body.id_token,
        state: body.state,
        user: body.user,
      });
      this.finishWebLogin(reply, await this.auth.loginWithSocialProfile(profile));
    } catch (err) {
      this.logger.error(`Fallo el callback de Apple: ${(err as Error).message}`);
      this.redirect(reply, this.auth.buildErrorRedirectUrl('apple_fallido'));
    }
  }

  @Public()
  @AuthThrottle()
  @Post('apple/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicio de sesion con Apple desde la app movil (identityToken nativo)' })
  async appleToken(
    @Body() dto: SocialTokenDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const profile = await this.oauth.verifyAppleIdentityToken(dto.token, dto.fullName);
    return this.respond(request, reply, await this.auth.loginWithSocialProfile(profile, dto.whatsapp));
  }

  /** Los flujos OAuth web siempre terminan en la app web: cookie + redireccion */
  private finishWebLogin(reply: FastifyReply, outcome: LoginOutcome): void {
    if (!isMfaChallenge(outcome)) {
      this.cookies.write(reply, 'web', outcome.refreshToken, this.tokens.refreshTtlSeconds);
    }
    this.redirect(reply, this.auth.buildRedirectUrl(outcome));
  }
}
