/**
 * Modelos que devuelve la API (servidor → cliente). Las fechas viajan como texto
 * ISO 8601.
 */

export type ItemStatus = 'pending' | 'purchased' | 'archived';
export type MemberRole = 'owner' | 'editor' | 'viewer';
export type AuthProvider = 'local' | 'google' | 'apple';
export type UserRole = 'user' | 'admin';
export type DevicePlatform = 'ios' | 'android' | 'web';

/** Idiomas de la interfaz, los correos y los avisos */
export type Locale = 'es' | 'en';

/**
 * Tipos de aviso conocidos. `AppNotification.type` es un texto abierto: el backend
 * puede sumar tipos nuevos y los clientes deben mostrar los que no reconozcan.
 */
export type NotificationType =
  | 'item.added'
  | 'item.purchased'
  | 'item.restored'
  | 'item.removed'
  | 'item.updated'
  | 'item.reactivated'
  | 'item.overdue'
  | 'list.shared'
  | 'list.updated'
  | 'member.left';

export interface User {
  id: string;
  fullName: string;
  email: string;
  whatsapp: string | null;
  avatarUrl: string | null;
  provider: AuthProvider;
  role: UserRole;
  notificationsEnabled: boolean;
  emailVerified: boolean;
  mfaEnabled: boolean;
  isActive: boolean;
  /** Idioma de sus correos y avisos; los clientes lo igualan al de su interfaz */
  locale: Locale;
  createdAt: string;
  /** Solo en el perfil propio: si la cuenta tiene contrasena definida */
  hasPassword?: boolean;
}

/** Lo minimo que se puede saber de otra persona (busqueda al compartir) */
export interface PublicProfile {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

export interface Item {
  id: string;
  listId: string;
  name: string;
  quantity: number;
  unit: string;
  note: string | null;
  category: string;
  status: ItemStatus;
  isRecurring: boolean;
  recurrenceDays: number | null;
  activatedAt: string;
  dueAt: string | null;
  nextActivationAt: string | null;
  purchasedAt: string | null;
  purchasedById: string | null;
  purchasedByName: string | null;
  lastPurchasedAt: string | null;
  cycleCount: number;
  createdById: string | null;
  createdByName: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  // ── campos calculados que consume la interfaz ──
  isOverdue: boolean;
  daysOverdue: number;
  daysUntilDue: number | null;
  daysUntilReactivation: number | null;
}

export interface Member {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: MemberRole;
  notifyOnChange: boolean;
  joinedAt: string;
}

export interface ListSummary {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  ownerId: string;
  isArchived: boolean;
  isShared: boolean;
  myRole: MemberRole;
  notifyOnChange: boolean;
  memberCount: number;
  pendingCount: number;
  purchasedCount: number;
  overdueCount: number;
  recurringCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListDetail extends ListSummary {
  members: Member[];
  /** Productos por comprar (lista de arriba) */
  pending: Item[];
  /** Productos ya comprados (lista de abajo, tachados) */
  purchased: Item[];
}

export interface AppNotification {
  id: string;
  /** Uno de `NotificationType`, o uno nuevo que el cliente todavia no conoce */
  type: string;
  title: string;
  body: string;
  listId: string | null;
  itemId: string | null;
  actorId: string | null;
  payload: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export interface AuthProviders {
  local: boolean;
  google: boolean;
  apple: boolean;
}

export interface OkResponse {
  ok: boolean;
}
