import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { ChangePasswordDto, UpdateProfileDto } from './dto/update-profile.dto';
import { toPublicUser } from './user.mapper';

@ApiTags('usuarios')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  async me(@CurrentUser() current: AuthenticatedUser) {
    return toPublicUser(await this.users.findById(current.id));
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualiza nombre, WhatsApp y preferencias de notificacion' })
  async updateMe(@CurrentUser() current: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return toPublicUser(await this.users.updateProfile(current.id, dto));
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Cambia la contrasena' })
  async changePassword(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.users.changePassword(current.id, dto);
    return { ok: true };
  }

  @Get('search')
  @ApiOperation({ summary: 'Busca personas para compartir una lista' })
  async search(@CurrentUser() current: AuthenticatedUser, @Query('q') q: string) {
    const results = await this.users.search(q ?? '', current.id);
    return results.map(toPublicUser);
  }
}
