import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuthProvider } from './auth-provider.enum';
import { User } from './user.entity';

/**
 * Cuenta de un proveedor externo (Google, Apple) vinculada a un usuario.
 *
 * Se identifica por el `sub` del proveedor, que nunca cambia, y no por el
 * correo: así un usuario puede cambiar el correo de su cuenta de Google sin
 * perder el acceso y puede tener Google y Apple vinculados a la vez.
 */
@Entity('user_identities')
@Index('uq_user_identities_provider_subject', ['provider', 'subject'], { unique: true })
export class UserIdentity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_user_identities_user')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.identities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: AuthProvider, enumName: 'users_provider_enum' })
  provider: AuthProvider;

  @Column({ length: 191 })
  subject: string;

  /** Correo que reportó el proveedor la última vez (solo informativo) */
  @Column({ type: 'varchar', length: 180, nullable: true })
  email: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;
}
