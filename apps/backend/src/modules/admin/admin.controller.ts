import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { UsersService } from '../users/users.service';
import { toPublicUser } from '../users/user.mapper';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../database/entities';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('administracion')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly users: UsersService,
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
    return { ...result, data: result.data.map(toPublicUser) };
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Activa o desactiva una cuenta' })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { isActive?: boolean },
  ) {
    const user = await this.users.setActive(id, body.isActive !== false);
    return toPublicUser(user);
  }

  @Get('lists')
  @ApiOperation({ summary: 'Listas creadas en el sistema' })
  listLists(@Query() query: PaginationDto) {
    return this.admin.listsPaginated(query.page, query.limit, query.search);
  }
}
