import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { DevicePlatform, DeviceToken } from '../../database/entities';

/**
 * Envío de notificaciones push a las apps de iOS y Android mediante Expo.
 * Si no hay dispositivos registrados (o no hay token de Expo configurado) la
 * llamada simplemente no hace nada: la notificación web por WebSocket ya salió.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly expo: Expo;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(DeviceToken) private readonly devices: Repository<DeviceToken>,
  ) {
    this.expo = new Expo({ accessToken: this.config.get<string>('push.expoAccessToken') });
  }

  async registerDevice(
    userId: string,
    token: string,
    platform: DevicePlatform,
    deviceName?: string,
  ): Promise<DeviceToken> {
    if (!Expo.isExpoPushToken(token)) {
      throw new BadRequestException('El token de notificaciones no es válido');
    }
    const existing = await this.devices.findOne({ where: { token } });
    if (existing) {
      // El mismo teléfono pasa a otra cuenta (cerró sesión sin darse de baja, o reinstaló): el
      // último registro gana, para que los avisos de la cuenta anterior no sigan llegando a él
      if (existing.userId !== userId) {
        this.logger.warn(`Token push ${existing.id} reasignado de ${existing.userId} a ${userId}`);
      }
      existing.userId = userId;
      existing.platform = platform;
      existing.deviceName = deviceName ?? existing.deviceName;
      existing.lastSeenAt = new Date();
      return this.devices.save(existing);
    }
    return this.devices.save(
      this.devices.create({
        userId,
        token,
        platform,
        deviceName: deviceName ?? null,
        lastSeenAt: new Date(),
      }),
    );
  }

  async unregisterDevice(userId: string, token: string): Promise<void> {
    await this.devices.delete({ userId, token });
  }

  async sendToUsers(
    userIds: string[],
    message: { title: string; body: string; data?: Record<string, unknown> },
  ): Promise<void> {
    if (!userIds.length) return;

    const devices = await this.devices.find({
      where: { userId: In(userIds), platform: In([DevicePlatform.IOS, DevicePlatform.ANDROID]) },
    });
    const valid = devices.filter((device) => Expo.isExpoPushToken(device.token));
    if (!valid.length) return;

    const messages: ExpoPushMessage[] = valid.map((device) => ({
      to: device.token,
      sound: 'default',
      title: message.title,
      body: message.body,
      data: message.data ?? {},
      channelId: 'listas',
      priority: 'high',
    }));

    try {
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];
      for (const chunk of chunks) {
        tickets.push(...(await this.expo.sendPushNotificationsAsync(chunk)));
      }
      // Los tokens que Expo reporta como no registrados se eliminan
      const dead: string[] = [];
      tickets.forEach((ticket, index) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          dead.push(valid[index].token);
        }
      });
      if (dead.length) await this.devices.delete({ token: In(dead) });
    } catch (error) {
      this.logger.warn(`No se pudieron enviar las push: ${(error as Error).message}`);
    }
  }
}
