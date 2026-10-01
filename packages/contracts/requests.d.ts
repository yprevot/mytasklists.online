/**
 * Cuerpos que envían los clientes (cliente → servidor). Los DTO del backend los
 * implementan, así que no pueden separarse sin que falle la compilación.
 */
import type { DevicePlatform, Locale, MemberRole } from './models';

// ── Autenticación ──────────────────────────────────────────────────────
export interface RegisterRequest {
  fullName: string;
  email: string;
  whatsapp: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Refresh y logout: la app móvil lo manda en el cuerpo; la web, en una cookie */
export interface RefreshRequest {
  refreshToken?: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface MfaCodeRequest {
  code: string;
}

export interface MfaVerifyRequest extends MfaCodeRequest {
  mfaToken: string;
}

export interface SocialTokenRequest {
  token: string;
  fullName?: string;
  whatsapp?: string;
}

export interface RegisterDeviceRequest {
  token: string;
  platform: DevicePlatform;
  deviceName?: string;
}

// ── Perfil ─────────────────────────────────────────────────────────────
export interface UpdateProfileRequest {
  fullName?: string;
  whatsapp?: string;
  notificationsEnabled?: boolean;
  avatarUrl?: string;
  locale?: Locale;
}

export interface ChangePasswordRequest {
  currentPassword?: string;
  newPassword: string;
}

/**
 * Borra la cuenta y sus datos (DELETE /users/me). Pide la contraseña si la cuenta
 * tiene una y el código de 2FA si está activa. En iOS, quien entró con Apple manda
 * un `authorizationCode` recién emitido para que el servidor revoque sus tokens.
 */
export interface DeleteAccountRequest {
  password?: string;
  mfaCode?: string;
  appleAuthorizationCode?: string;
}

// ── Listas ─────────────────────────────────────────────────────────────
export interface CreateListRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateListRequest {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  isArchived?: boolean;
}

export interface ShareListRequest {
  email?: string;
  userId?: string;
  role?: MemberRole;
}

export interface UpdateMemberRequest {
  notifyOnChange?: boolean;
  role?: MemberRole;
}

// ── Productos ──────────────────────────────────────────────────────────
export interface CreateItemRequest {
  name: string;
  quantity?: number;
  unit?: string;
  note?: string;
  category?: string;
  isRecurring?: boolean;
  recurrenceDays?: number;
}

export interface UpdateItemRequest {
  name?: string;
  quantity?: number;
  unit?: string;
  note?: string;
  category?: string;
  isRecurring?: boolean;
  recurrenceDays?: number | null;
}

export interface ReorderItemsRequest {
  itemIds: string[];
}
