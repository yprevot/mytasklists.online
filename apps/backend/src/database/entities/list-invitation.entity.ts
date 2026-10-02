import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ShoppingList } from './shopping-list.entity';
import { MemberRole } from './list-member.entity';

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REVOKED = 'revoked',
}

@Entity('list_invitations')
export class ListInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'list_id', type: 'uuid' })
  listId: string;

  @ManyToOne(() => ShoppingList, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'list_id' })
  list: ShoppingList;

  @Index()
  @Column({ length: 180 })
  email: string;

  @Index({ unique: true })
  @Column({ length: 64 })
  token: string;

  @Column({ name: 'invited_by_id', type: 'uuid', nullable: true })
  invitedById: string | null;

  @Column({ type: 'enum', enum: MemberRole, default: MemberRole.EDITOR })
  role: MemberRole;

  @Column({ type: 'enum', enum: InvitationStatus, default: InvitationStatus.PENDING })
  status: InvitationStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'last_sent_at', type: 'timestamptz', nullable: true })
  lastSentAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
