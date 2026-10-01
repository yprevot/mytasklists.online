import { Body, Controller, Delete, HttpCode, HttpStatus, Patch, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { AuthCookieService } from './auth-cookie.service';
import { TokenService } from './token.service';
import { ChangePasswordDto, DeleteAccountDto } from '../users/dto/update-profile.dto';
import { AccountDeletionService } from './account-deletion.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { AuthThrottle } from '../../common/throttle/throttle-profiles';

/**
 * Operaciones de la cuenta que afectan a las sesiones. Conserva la ruta
 * histórica `/users/me/password`, pero vive aquí porque necesita revocar
 * tokens y emitir un par nuevo.
 */
@ApiTags('usuarios')
@ApiBearerAuth()
@Controller('users')
export class AccountController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookieService,
    private readonly tokens: TokenService,
    private readonly deletion: AccountDeletionService,
  ) {}

  @AuthThrottle()
  @Patch('me/password')
  @ApiOperation({
    summary: 'Cambia la contraseña, cierra las demás sesiones y devuelve un par de tokens nuevo',
  })
  async changePassword(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const session = await this.auth.changePassword(current.id, dto.currentPassword, dto.newPassword);
    const client = this.cookies.clientOf(request);
    if (!client) return { ok: true, ...session };
    this.cookies.write(reply, client, session.refreshToken, this.tokens.refreshTtlSeconds);
    const { refreshToken: _omit, ...rest } = session;
    return { ok: true, ...rest };
  }

  @AuthThrottle()
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Elimina la cuenta y sus datos, cierra todas las sesiones y revoca Sign in with Apple',
  })
  async deleteAccount(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.deletion.deleteAccount(current.id, dto ?? {});
    const client = this.cookies.clientOf(request);
    if (client) this.cookies.clear(reply, client);
    return { ok: true, ...result };
  }
}
