import type { PublicProfile, User } from '@lista/contracts';
import { User as UserEntity } from '../../database/entities';

// Las formas públicas viven en el contrato compartido con los clientes
export type PublicUser = User;
export type { PublicProfile };

/** Nunca exponemos el hash de la contraseña ni el secreto de 2FA al cliente */
export const toPublicUser = (user: UserEntity, extra: { hasPassword?: boolean } = {}): PublicUser => ({
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
  locale: user.locale,
  createdAt: new Date(user.createdAt).toISOString(),
  ...(extra.hasPassword === undefined ? {} : { hasPassword: extra.hasPassword }),
});

export const toPublicProfile = (user: UserEntity): PublicProfile => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  avatarUrl: user.avatarUrl ?? null,
});
