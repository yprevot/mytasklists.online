export type ItemStatus = 'pending' | 'purchased' | 'archived';
export type MemberRole = 'owner' | 'editor' | 'viewer';

export interface User {
  id: string;
  fullName: string;
  email: string;
  whatsapp: string | null;
  avatarUrl: string | null;
  provider: 'local' | 'google' | 'apple';
  role: 'user' | 'admin';
  notificationsEnabled: boolean;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  tokenType: 'Bearer';
  user: User;
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
  pending: Item[];
  purchased: Item[];
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  listId: string | null;
  itemId: string | null;
  actorId: string | null;
  payload: Record<string, unknown>;
  isRead?: boolean;
  createdAt: string;
}

export interface AuthProviders {
  local: boolean;
  google: boolean;
  apple: boolean;
}
