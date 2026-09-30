import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { UsersService } from '../users/users.service';
import { toPublicUser } from '../users/user.mapper';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../database/entities';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { TokenService } from '../auth/token.service';
import { MfaService } from '../auth/mfa.service';
import { AuthStateService } from '../../redis/auth-state.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

@ApiTags('administracion')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly mfa: MfaService,
    private readonly authState: AuthStateService,
    private readonly realtime: RealtimeGateway,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Indicadores globales del sistema' })
  stats() {
    return this.admin.stats();
  }

  @Get('timeseries')
  @ApiOperation({ summary: 'Serie diaria de altas, compras y registros' })
  timeseries(@Query('days') days?: string) {
    return this.admin.timeseries(Math.min(90, Math.max(1, parseInt(days ?? '14', 10) || 14)));
  }

  @Get('activity')
  @ApiOperation({ summary: 'Bitacora reciente' })
  activity(@Query('limit') limit?: string) {
    return this.admin.recentActivity(Math.min(200, Math.max(1, parseInt(limit ?? '40', 10) || 40)));
  }

  @Get('users')
  @ApiOperation({ summary: 'Usuarios registrados' })
  async listUsers(@Query() query: PaginationDto) {
    const result = await this.users.findAllPaginated(query.page, query.limit, query.search);
    return { ...result, data: result.data.map((user) => toPublicUser(user)) };
  }

  @Patch('users/:id')
  @ApiOperation({
    summary: 'Activa o desactiva una cuenta, o restablece su verificacion en dos pasos',
  })
  async updateUser(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAdminUserDto,
  ) {
    if (body.resetMfa) {
      await this.mfa.disable(id);
      await this.tokens.revokeAll(id);
    }
    if (body.isActive !== undefined) {
      if (id === admin.id && !body.isActive) {
        throw new BadRequestException('No puedes desactivar tu propia cuenta');
      }
      await this.users.setActive(id, body.isActive);
      await this.authState.setDisabled(id, !body.isActive);
      if (!body.isActive) {
        // Corta de inmediato: refresh tokens, access tokens ya emitidos y WebSockets
        await this.tokens.revokeAll(id);
        await this.realtime.disconnectUser(id);
      }
    }
    return toPublicUser(await this.users.findById(id));
  }

  @Get('lists')
  @ApiOperation({ summary: 'Listas creadas en el sistema' })
  listLists(@Query() query: PaginationDto) {
    return this.admin.listsPaginated(query.page, query.limit, query.search);
  }
}
