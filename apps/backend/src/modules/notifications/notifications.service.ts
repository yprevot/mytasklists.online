import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ListMember,
  Notification,
  NotificationChannel,
  NotificationType,
} from '../../database/entities';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { RT } from '../realtime/realtime.events';
import { PushService } from './push.service';
import { toNotificationView } from './notification.mapper';
import { NOTIFICATION_TEXTS } from './notification.texts';
import { DEFAULT_LOCALE, type Locale } from '../../i18n/locale';

export interface NotifyInput {
  listId: string;
  listName: string;
  itemId?: string | null;
  actorId?: string | null;
  actorName?: string;
  type: NotificationType;
  /** Título y cuerpo en el idioma de cada destinatario */
  render: (texts: (typeof NOTIFICATION_TEXTS)[Locale]) => { title: string; body: string };
  payload?: Record<string, unknown>;
  /** Si se indica, esa persona no recibe el aviso (normalmente quien hizo el cambio) */
  excludeUserId?: string | null;
  /** Fuerza el envío a un conjunto concreto de usuarios */
  onlyUserIds?: string[];
}

/**
 * Reparte los avisos entre los integrantes de una lista compartida.
 *
 *  - En la web se entregan por WebSocket y el cliente los muestra como pop-up.
 *  - En la app móvil se entregan como notificación push de iOS/Android.
 *
 * Cada integrante decide si quiere recibirlos (`list_members.notify_on_change`),
 * y además existe un interruptor global por usuario (`users.notifications_enabled`).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private readonly repo: Repository<Notification>,
    @InjectRepository(ListMember) private readonly members: Repository<ListMember>,
    private readonly realtime: RealtimeGateway,
    private readonly push: PushService,
  ) {}

  private async resolveRecipients(input: NotifyInput): Promise<ListMember[]> {
    const members = await this.members.find({
      where: { listId: input.listId },
      relations: { user: true },
    });
    return members.filter((member) => {
      if (input.onlyUserIds && !input.onlyUserIds.includes(member.userId)) return false;
      if (input.excludeUserId && member.userId === input.excludeUserId) return false;
      if (!member.notifyOnChange) return false;
      if (member.user && member.user.notificationsEnabled === false) return false;
      if (member.user && member.user.isActive === false) return false;
      return true;
    });
  }

  async notifyListMembers(input: NotifyInput): Promise<void> {
    const recipients = await this.resolveRecipients(input);
    if (!recipients.length) return;

    const localeOf = (member: ListMember): Locale => member.user?.locale ?? DEFAULT_LOCALE;
    const texts = (locale: Locale) => input.render(NOTIFICATION_TEXTS[locale]);

    const rows = recipients.map((member) =>
      this.repo.create({
        ...texts(localeOf(member)),
        userId: member.userId,
        listId: input.listId,
        itemId: input.itemId ?? null,
        actorId: input.actorId ?? null,
        type: input.type,
        channel: NotificationChannel.BOTH,
        payload: {
          listName: input.listName,
          actorName: input.actorName ?? null,
          ...(input.payload ?? {}),
        },
      }),
    );
    const saved = await this.repo.save(rows);

    // Pop-up en la web
    for (const notification of saved) {
      this.realtime.emitToUser(notification.userId, RT.NOTIFICATION, toNotificationView(notification));
    }

    // Push en iOS/Android: un envío por idioma
    for (const locale of new Set(recipients.map(localeOf))) {
      await this.push.sendToUsers(
        recipients.filter((member) => localeOf(member) === locale).map((member) => member.userId),
        {
          ...texts(locale),
          data: { listId: input.listId, itemId: input.itemId ?? null, type: input.type },
        },
      );
    }
  }

  async listForUser(userId: string, onlyUnread = false, limit = 50): Promise<Notification[]> {
    return this.repo.find({
      where: onlyUnread ? { userId, isRead: false } : { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.repo.count({ where: { userId, isRead: false } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.repo.update({ id, userId }, { isRead: true });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repo.update({ userId, isRead: false }, { isRead: true });
  }
}
