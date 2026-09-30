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
  mfaEnabled: boolean;
  isActive: boolean;
  createdAt: Date;
  /** Solo se incluye en el perfil propio: indica si puede cambiar la contrasena actual */
  hasPassword?: boolean;
}

/** Lo minimo que se puede saber de otra persona (busqueda al compartir) */
export interface PublicProfile {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

/** Nunca exponemos el hash de la contrasena ni el secreto de 2FA al cliente */
export const toPublicUser = (user: User, extra: { hasPassword?: boolean } = {}): PublicUser => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  whatsapp: user.whatsapp ?? null,
  avatarUrl: user.avatarUrl ?? null,
  provider: user.provider,
  role: user.role,
  notificationsEnabled: user.notificationsEnabled,
  emailVerified: user.emailVerified,
  mfaEnabled: Boolean(user.totpEnabled),
  isActive: user.isActive,
  createdAt: user.createdAt,
  ...(extra.hasPassword === undefined ? {} : { hasPassword: extra.hasPassword }),
});

export const toPublicProfile = (user: User): PublicProfile => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  avatarUrl: user.avatarUrl ?? null,
});
