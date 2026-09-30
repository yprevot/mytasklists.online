// Las cuentas tienen la misma forma que en el contrato compartido con el backend
export type { User as AdminUser } from '@lista/contracts';

export interface AdminStats {
  users: { total: number; active: number; newLast7Days: number; byProvider: Record<string, number> };
  lists: { total: number; shared: number; archived: number; averageItems: number };
  items: {
    total: number;
    pending: number;
    purchased: number;
    archived: number;
    recurring: number;
    overdue: number;
    purchasedToday: number;
  };
  notifications: { total: number; unread: number };
  generatedAt: string;
}

export interface SeriesPoint {
  day: string;
  created: number;
  purchased: number;
  signups: number;
}

export interface ActivityRow {
  id: string;
  action: string;
  summary: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  userId: string | null;
  userName: string;
  listId: string | null;
  listName: string | null;
}

export interface AdminListRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  isArchived: boolean;
  ownerName: string;
  ownerEmail: string;
  memberCount: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
