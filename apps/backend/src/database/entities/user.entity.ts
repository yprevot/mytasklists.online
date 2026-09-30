import type { Locale } from '@lista/contracts';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ListMember } from './list-member.entity';
import { ShoppingList } from './shopping-list.entity';
import { DeviceToken } from './device-token.entity';
import { UserIdentity } from './user-identity.entity';
import { AuthProvider } from './auth-provider.enum';

export { AuthProvider };

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name', length: 160 })
  fullName: string;

  @Index({ unique: true })
  @Column({ length: 180 })
  email: string;

  /** Numero de WhatsApp en formato E.164, p. ej. +5215512345678 */
  @Column({ type: 'varchar', length: 25, nullable: true })
  whatsapp: string | null;

  @Column({ name: 'password_hash', type: 'varchar', length: 120, nullable: true, select: false })
  passwordHash: string | null;

  /** Metodo con el que se creo la cuenta. Los proveedores vinculados viven en `identities` */
  @Column({ type: 'enum', enum: AuthProvider, default: AuthProvider.LOCAL })
  provider: AuthProvider;

  @Column({ name: 'provider_id', type: 'varchar', length: 191, nullable: true })
  providerId: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** Secreto TOTP cifrado con AES-256-GCM (ver MfaService) */
  @Column({ name: 'totp_secret', type: 'varchar', length: 255, nullable: true, select: false })
  totpSecret: string | null;

  @Column({ name: 'totp_enabled', default: false })
  totpEnabled: boolean;

  /** Hashes SHA-256 de los codigos de recuperacion de 2FA que siguen sin usarse */
  @Column({
    name: 'totp_recovery_codes',
    type: 'jsonb',
    nullable: true,
    select: false,
  })
  totpRecoveryCodes: string[] | null;

  /** Idioma de sus correos y avisos (es | en); los clientes lo igualan al de su interfaz */
  @Column({ type: 'varchar', length: 5, default: 'es' })
  locale: Locale;

  /** Preferencia global: recibir avisos cuando alguien mas edita una lista compartida */
  @Column({ name: 'notifications_enabled', default: true })
  notificationsEnabled: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => ShoppingList, (list) => list.owner)
  ownedLists: ShoppingList[];

  @OneToMany(() => ListMember, (member) => member.user)
  memberships: ListMember[];

  @OneToMany(() => DeviceToken, (token) => token.user)
  devices: DeviceToken[];

  @OneToMany(() => UserIdentity, (identity) => identity.user)
  identities: UserIdentity[];
}
