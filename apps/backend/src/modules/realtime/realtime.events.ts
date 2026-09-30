/** Nombres de los eventos que viajan por WebSocket entre el backend y los clientes */
export const RT = {
  // servidor → cliente
  ITEM_CREATED: 'item:created',
  ITEM_UPDATED: 'item:updated',
  ITEM_PURCHASED: 'item:purchased',
  ITEM_RESTORED: 'item:restored',
  ITEM_REMOVED: 'item:removed',
  ITEM_REACTIVATED: 'item:reactivated',
  ITEM_OVERDUE: 'item:overdue',
  LIST_UPDATED: 'list:updated',
  LIST_DELETED: 'list:deleted',
  LIST_MEMBER_ADDED: 'list:member-added',
  LIST_MEMBER_REMOVED: 'list:member-removed',
  NOTIFICATION: 'notification',
  PRESENCE: 'list:presence',

  // cliente → servidor
  JOIN: 'list:join',
  LEAVE: 'list:leave',
} as const;

export const listRoom = (listId: string): string => `list:${listId}`;
export const userRoom = (userId: string): string => `user:${userId}`;

export interface RealtimeActor {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
}
