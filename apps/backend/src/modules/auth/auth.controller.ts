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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { LoginDto, RefreshDto, RegisterDto, SocialTokenDto } from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';

@ApiTags('autenticacion')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly oauth: OAuthService,
  ) {}

  private redirect(reply: FastifyReply, url: string): void {
    reply.header('location', url).code(302).send();
  }

  // ── Registro y sesion con correo/contrasena ─────────────────────────
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registro con nombre, correo, WhatsApp y contrasena' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicio de sesion con correo y contrasena' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renueva el par de tokens' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cierra la sesion actual' })
  async logout(@CurrentUser() user: AuthenticatedUser, @Body() dto: Partial<RefreshDto>) {
    await this.auth.logout(dto?.refreshToken, user.id);
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

  // ─────────────────────────────── Google ─────────────────────────────
  @Public()
  @Get('google')
  @ApiOperation({ summary: 'Inicia el flujo OAuth con Google (web)' })
  async google(@Res() reply: FastifyReply, @Query('returnTo') returnTo?: string) {
    this.redirect(reply, await this.oauth.buildGoogleAuthUrl(returnTo));
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
      return this.redirect(reply, this.auth.buildErrorRedirectUrl(error ?? 'google_cancelado'));
    }
    try {
      const { profile, returnTo } = await this.oauth.handleGoogleCallback(code, state);
      const result = await this.auth.loginWithSocialProfile(profile);
      this.redirect(reply, this.auth.buildRedirectUrl(result, returnTo));
    } catch (err) {
      this.logger.error(`Fallo el callback de Google: ${(err as Error).message}`);
      this.redirect(reply, this.auth.buildErrorRedirectUrl('google_fallido'));
    }
  }

  @Public()
  @Post('google/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicio de sesion con Google desde la app movil (id_token nativo)' })
  async googleToken(@Body() dto: SocialTokenDto) {
    const profile = await this.oauth.verifyGoogleIdToken(dto.token);
    if (dto.fullName) profile.fullName = dto.fullName;
    return this.auth.loginWithSocialProfile(profile, dto.whatsapp);
  }

  // ──────────────────────────────── Apple ─────────────────────────────
  @Public()
  @Get('apple')
  @ApiOperation({ summary: 'Inicia el flujo Sign in with Apple (web)' })
  async apple(@Res() reply: FastifyReply, @Query('returnTo') returnTo?: string) {
    this.redirect(reply, await this.oauth.buildAppleAuthUrl(returnTo));
  }

  @Public()
  @Post('apple/callback')
  @ApiOperation({ summary: 'Callback de Apple (form_post)' })
  async appleCallback(@Res() reply: FastifyReply, @Req() request: any) {
    const body = (request.body ?? {}) as Record<string, string>;
    if (body.error || !body.state) {
      return this.redirect(reply, this.auth.buildErrorRedirectUrl(body.error ?? 'apple_cancelado'));
    }
    try {
      const { profile, returnTo } = await this.oauth.handleAppleCallback({
        code: body.code,
        idToken: body.id_token,
        state: body.state,
        user: body.user,
      });
      const result = await this.auth.loginWithSocialProfile(profile);
      this.redirect(reply, this.auth.buildRedirectUrl(result, returnTo));
    } catch (err) {
      this.logger.error(`Fallo el callback de Apple: ${(err as Error).message}`);
      this.redirect(reply, this.auth.buildErrorRedirectUrl('apple_fallido'));
    }
  }

  @Public()
  @Post('apple/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicio de sesion con Apple desde la app movil (identityToken nativo)' })
  async appleToken(@Body() dto: SocialTokenDto) {
    const profile = await this.oauth.verifyAppleIdentityToken(dto.token, dto.fullName);
    return this.auth.loginWithSocialProfile(profile, dto.whatsapp);
  }
}
