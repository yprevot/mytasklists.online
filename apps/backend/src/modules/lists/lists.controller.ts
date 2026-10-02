import { SensitiveThrottle } from '../../common/throttle/throttle-profiles';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListsService } from './lists.service';
import { CreateListDto, ShareListDto, UpdateListDto, UpdateMemberDto } from './dto/list.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';

@ApiTags('listas')
@ApiBearerAuth()
@Controller('lists')
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  @Get()
  @ApiOperation({ summary: 'Listas del usuario (propias y compartidas con él)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.lists.findAllForUser(user.id, includeArchived === 'true');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crea una lista de compras' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateListDto) {
    return this.lists.create(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una lista con pendientes y comprados' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.lists.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza los datos de la lista' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListDto,
  ) {
    return this.lists.update(id, user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Elimina la lista (solo la persona propietaria)' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.lists.remove(id, user.id);
    return { ok: true };
  }

  @Get(':id/invitations')
  pendingInvitations(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.lists.pendingInvitations(id, user.id);
  }

  @Delete(':id/invitations/:invitationId')
  revokeInvitation(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string) {
    return this.lists.revokeInvitation(id, user.id, invitationId);
  }

  // ── Integrantes ─────────────────────────────────────────────────────
  @SensitiveThrottle()
  @Post(':id/share')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Comparte la lista con otra persona registrada' })
  share(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShareListDto,
  ) {
    return this.lists.share(id, user.id, dto);
  }

  @Patch(':id/members/:userId')
  @ApiOperation({ summary: 'Cambia el rol o la preferencia de aviso de un integrante' })
  updateMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) memberUserId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.lists.updateMember(id, user.id, memberUserId, dto);
  }

  @Patch(':id/notifications')
  @ApiOperation({ summary: 'Activa o desactiva mis avisos para esta lista' })
  updateMyNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.lists.updateMember(id, user.id, user.id, {
      notifyOnChange: dto.notifyOnChange,
    });
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Quita a un integrante (o sale uno mismo de la lista)' })
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) memberUserId: string,
  ) {
    await this.lists.removeMember(id, user.id, memberUserId);
    return { ok: true };
  }
}
