import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum NotificationType {
  ITEM_ADDED = 'item.added',
  ITEM_PURCHASED = 'item.purchased',
  ITEM_RESTORED = 'item.restored',
  ITEM_REMOVED = 'item.removed',
  ITEM_UPDATED = 'item.updated',
  ITEM_REACTIVATED = 'item.reactivated',
  ITEM_OVERDUE = 'item.overdue',
  LIST_SHARED = 'list.shared',
  LIST_UPDATED = 'list.updated',
  MEMBER_LEFT = 'member.left',
}

export enum NotificationChannel {
  WEB = 'web',
  PUSH = 'push',
  BOTH = 'both',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'list_id', type: 'uuid', nullable: true })
  listId: string | null;

  @Column({ name: 'item_id', type: 'uuid', nullable: true })
  itemId: string | null;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ length: 160 })
  title: string;

  @Column({ length: 400 })
  body: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload: Record<string, unknown>;

  @Column({ type: 'enum', enum: NotificationChannel, default: NotificationChannel.BOTH })
  channel: NotificationChannel;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
