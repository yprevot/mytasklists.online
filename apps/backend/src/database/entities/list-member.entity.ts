import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { ShoppingList } from './shopping-list.entity';

export enum MemberRole {
  OWNER = 'owner',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

@Entity('list_members')
@Unique('uq_list_member', ['listId', 'userId'])
export class ListMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'list_id', type: 'uuid' })
  listId: string;

  @ManyToOne(() => ShoppingList, (list) => list.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'list_id' })
  list: ShoppingList;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.memberships, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: MemberRole, default: MemberRole.EDITOR })
  role: MemberRole;

  /**
   * Cada integrante decide si quiere ser avisado cuando otra persona
   * modifica la lista (pop-up en web, push en móvil).
   */
  @Column({ name: 'notify_on_change', default: true })
  notifyOnChange: boolean;

  @CreateDateColumn({ name: 'joined_at', type: 'timestamptz' })
  joinedAt: Date;
}
