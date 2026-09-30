export type ItemStatus = 'pending' | 'purchased' | 'archived';

export interface User {
  id: string;
  fullName: string;
  email: string;
  whatsapp: string | null;
  avatarUrl: string | null;
  provider: 'local' | 'google' | 'apple';
  role: 'user' | 'admin';
  notificationsEnabled: boolean;
  createdAt: string;
}

export interface Item {
  id: string;
  listId: string;
  name: string;
  quantity: number;
  unit: string;
  note: string | null;
  status: ItemStatus;
  isRecurring: boolean;
  recurrenceDays: number | null;
  dueAt: string | null;
  nextActivationAt: string | null;
  purchasedAt: string | null;
  purchasedByName: string | null;
  cycleCount: number;
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
  role: string;
  notifyOnChange: boolean;
}

export interface ListSummary {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  ownerId: string;
  isShared: boolean;
  myRole: string;
  notifyOnChange: boolean;
  memberCount: number;
  pendingCount: number;
  purchasedCount: number;
  overdueCount: number;
  recurringCount: number;
}

export interface ListDetail extends ListSummary {
  members: Member[];
  pending: Item[];
  purchased: Item[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}
