import type { AppNotification } from '@lista/contracts';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { toNotificationView } from './notification.mapper';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { RegisterDeviceDto } from '../auth/dto/auth.dto';
import { AuthThrottle } from '../../common/throttle/throttle-profiles';

@ApiTags('notificaciones')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Avisos recibidos por el usuario' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('unread') unread?: string,
  ): Promise<AppNotification[]> {
    const rows = await this.notifications.listForUser(user.id, unread === 'true');
    return rows.map(toNotificationView);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Número de avisos sin leer' })
  async unread(@CurrentUser() user: AuthenticatedUser) {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marca un aviso como leído' })
  async markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.notifications.markRead(user.id, id);
    return { ok: true };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marca todos los avisos como leídos' })
  async markAll(@CurrentUser() user: AuthenticatedUser) {
    await this.notifications.markAllRead(user.id);
    return { ok: true };
  }

  @AuthThrottle()
  @Post('devices')
  @ApiOperation({ summary: 'Registra el token push del dispositivo móvil' })
  async registerDevice(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterDeviceDto) {
    const device = await this.push.registerDevice(
      user.id,
      dto.token,
      dto.platform,
      dto.deviceName,
    );
    return { id: device.id, platform: device.platform };
  }

  @Delete('devices/:token')
  @ApiOperation({ summary: 'Da de baja el token push del dispositivo' })
  async unregisterDevice(@CurrentUser() user: AuthenticatedUser, @Param('token') token: string) {
    await this.push.unregisterDevice(user.id, token);
    return { ok: true };
  }
}
