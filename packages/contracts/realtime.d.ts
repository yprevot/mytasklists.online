/**
 * Eventos de Socket.IO. `ServerEvents` son los que emite el backend y
 * `ClientEvents` los que mandan los clientes.
 */
import type { AppNotification, Item, ListDetail, Member } from './models';

export interface ConnectedEvent {
  userId: string;
  lists: string[];
  serverTime: string;
}

export interface ItemEvent {
  listId: string;
  item: Item;
  /** null cuando el cambio lo hizo el programador de recurrencias */
  actorId: string | null;
}

export interface ItemOverdueEvent {
  listId: string;
  item: Item;
}

export interface ItemRemovedEvent {
  listId: string;
  itemId: string;
  actorId: string;
  /** false: la tarjeta se cerró pero el producto recurrente volverá */
  permanent: boolean;
  willReturnAt?: string | null;
}

export interface ListUpdatedEvent {
  listId: string;
  actorId: string;
  list?: ListDetail;
  reordered?: string[];
  clearedItemIds?: string[];
}

export interface ListDeletedEvent {
  listId: string;
  actorId: string;
}

export interface MemberAddedEvent {
  listId: string;
  member: Member;
  actorId: string;
}

export interface MemberRemovedEvent {
  listId: string;
  userId: string;
  actorId: string;
}

export interface PresenceEvent {
  listId: string;
  userId: string;
  status: 'online';
}

export interface ServerEvents {
  connected: ConnectedEvent;
  'item:created': ItemEvent;
  'item:updated': ItemEvent;
  'item:purchased': ItemEvent;
  'item:restored': ItemEvent;
  'item:removed': ItemRemovedEvent;
  'item:reactivated': ItemEvent;
  'item:overdue': ItemOverdueEvent;
  'list:updated': ListUpdatedEvent;
  'list:deleted': ListDeletedEvent;
  'list:member-added': MemberAddedEvent;
  'list:member-removed': MemberRemovedEvent;
  'list:presence': PresenceEvent;
  notification: AppNotification;
}

export interface ClientEvents {
  'list:join': { listId: string };
  'list:leave': { listId: string };
}

export type ServerEventName = keyof ServerEvents;
export type ClientEventName = keyof ClientEvents;
