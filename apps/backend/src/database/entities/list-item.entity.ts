import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ShoppingList } from './shopping-list.entity';
import { User } from './user.entity';

/** Postgres devuelve `numeric` como string; lo convertimos a number */
const numericTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null): number => (value === null ? 0 : parseFloat(value)),
};

export enum ItemStatus {
  /** Visible en la lista de arriba, pendiente de comprar */
  PENDING = 'pending',
  /** Comprado: se muestra tachado en la lista de abajo */
  PURCHASED = 'purchased',
  /** El usuario lo quitó de la lista de abajo con la "x" */
  ARCHIVED = 'archived',
}

@Entity('list_items')
@Index('idx_item_list_status', ['listId', 'status'])
@Index('idx_item_next_activation', ['nextActivationAt'])
export class ListItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'list_id', type: 'uuid' })
  listId: string;

  @ManyToOne(() => ShoppingList, (list) => list.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'list_id' })
  list: ShoppingList;

  @Column({ length: 140 })
  name: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 1, transformer: numericTransformer })
  quantity: number;

  @Column({ length: 20, default: 'pza' })
  unit: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  note: string | null;

  @Column({ length: 40, default: 'general' })
  category: string;

  /** Nombre aleatorio del archivo; nunca conserva el nombre aportado por el cliente. */
  @Column({ name: 'image_key', type: 'varchar', length: 80, nullable: true })
  imageKey: string | null;

  @Column({ name: 'image_bytes', type: 'integer', default: 0 })
  imageBytes: number;

  @Column({ type: 'enum', enum: ItemStatus, default: ItemStatus.PENDING })
  status: ItemStatus;

  // ── Recurrencia ────────────────────────────────────────────────────
  /** true = el producto vuelve a activarse solo cada `recurrenceDays` días */
  @Column({ name: 'is_recurring', default: false })
  isRecurring: boolean;

  @Column({ name: 'recurrence_days', type: 'int', nullable: true })
  recurrenceDays: number | null;

  /** Momento en el que el producto entró (o volvió a entrar) a la lista de pendientes */
  @Column({ name: 'activated_at', type: 'timestamptz', default: () => 'now()' })
  activatedAt: Date;

  /** activatedAt + recurrenceDays. Si se pasa sin comprarse, el producto se marca como vencido */
  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt: Date | null;

  /** purchasedAt + recurrenceDays: cuando el scheduler debe reactivarlo */
  @Column({ name: 'next_activation_at', type: 'timestamptz', nullable: true })
  nextActivationAt: Date | null;

  @Column({ name: 'purchased_at', type: 'timestamptz', nullable: true })
  purchasedAt: Date | null;

  @Column({ name: 'purchased_by_id', type: 'uuid', nullable: true })
  purchasedById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'purchased_by_id' })
  purchasedBy: User | null;

  @Column({ name: 'last_purchased_at', type: 'timestamptz', nullable: true })
  lastPurchasedAt: Date | null;

  /** Cuántas veces se ha completado el ciclo de recurrencia */
  @Column({ name: 'cycle_count', type: 'int', default: 0 })
  cycleCount: number;

  /** Marca de la última vez que se avisó del vencimiento, para no repetir el aviso */
  @Column({ name: 'overdue_notified_at', type: 'timestamptz', nullable: true })
  overdueNotifiedAt: Date | null;

  // ── Metadatos ──────────────────────────────────────────────────────
  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
