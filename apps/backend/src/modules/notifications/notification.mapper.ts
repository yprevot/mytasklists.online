import type { AppNotification } from '@lista/contracts';
import { Notification } from '../../database/entities';

export const toNotificationView = (notification: Notification): AppNotification => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  body: notification.body,
  listId: notification.listId,
  itemId: notification.itemId,
  actorId: notification.actorId,
  payload: notification.payload,
  isRead: notification.isRead,
  createdAt: new Date(notification.createdAt).toISOString(),
});
