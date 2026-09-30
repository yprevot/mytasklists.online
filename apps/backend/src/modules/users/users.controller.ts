import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { toPublicProfile, toPublicUser } from './user.mapper';

@ApiTags('usuarios')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  async me(@CurrentUser() current: AuthenticatedUser) {
    const [user, hasPassword] = await Promise.all([
      this.users.findById(current.id),
      this.users.hasPassword(current.id),
    ]);
    return toPublicUser(user, { hasPassword });
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualiza nombre, WhatsApp y preferencias de notificación' })
  async updateMe(@CurrentUser() current: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return toPublicUser(await this.users.updateProfile(current.id, dto));
  }

  // El cambio de contraseña vive en AuthModule (AccountController) porque
  // también revoca las sesiones y emite un par de tokens nuevo.

  @Get('search')
  @ApiOperation({
    summary: 'Busca a una persona por su correo exacto para compartir una lista',
  })
  async search(@CurrentUser() current: AuthenticatedUser, @Query('q') q: string) {
    const results = await this.users.searchByExactEmail(q ?? '', current.id);
    return results.map(toPublicProfile);
  }
}
