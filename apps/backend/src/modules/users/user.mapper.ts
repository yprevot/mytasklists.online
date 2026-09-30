import { User } from '../../database/entities';

export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  whatsapp: string | null;
  avatarUrl: string | null;
  provider: string;
  role: string;
  notificationsEnabled: boolean;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: Date;
}

/** Nunca exponemos el hash de la contrasena al cliente */
export const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  whatsapp: user.whatsapp ?? null,
  avatarUrl: user.avatarUrl ?? null,
  provider: user.provider,
  role: user.role,
  notificationsEnabled: user.notificationsEnabled,
  emailVerified: user.emailVerified,
  isActive: user.isActive,
  createdAt: user.createdAt,
});
