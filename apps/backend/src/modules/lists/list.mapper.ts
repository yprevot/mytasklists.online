import { ItemStatus, ListMember, ShoppingList } from '../../database/entities';
import { isItemOverdue, ItemView, toItemView } from '../items/item.mapper';

export interface MemberView {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  notifyOnChange: boolean;
  joinedAt: string;
}

export interface ListSummaryView {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  ownerId: string;
  isArchived: boolean;
  isShared: boolean;
  myRole: string;
  notifyOnChange: boolean;
  memberCount: number;
  pendingCount: number;
  purchasedCount: number;
  overdueCount: number;
  recurringCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListDetailView extends ListSummaryView {
  members: MemberView[];
  /** Productos por comprar (lista de arriba) */
  pending: ItemView[];
  /** Productos ya comprados (lista de abajo, tachados) */
  purchased: ItemView[];
}

export const toMemberView = (member: ListMember): MemberView => ({
  id: member.id,
  userId: member.userId,
  fullName: member.user?.fullName ?? 'Usuario',
  email: member.user?.email ?? '',
  avatarUrl: member.user?.avatarUrl ?? null,
  role: member.role,
  notifyOnChange: member.notifyOnChange,
  joinedAt: new Date(member.joinedAt).toISOString(),
});

export const toListDetailView = (
  list: ShoppingList,
  currentUserId: string,
  now: Date = new Date(),
): ListDetailView => {
  const members = (list.members ?? []).map(toMemberView);
  const mine = (list.members ?? []).find((member) => member.userId === currentUserId);
  const items = list.items ?? [];

  const pending = items
    .filter((item) => item.status === ItemStatus.PENDING)
    .sort((a, b) => a.sortOrder - b.sortOrder || +new Date(a.createdAt) - +new Date(b.createdAt))
    .map((item) => toItemView(item, now));

  const purchased = items
    .filter((item) => item.status === ItemStatus.PURCHASED)
    .sort((a, b) => +new Date(b.purchasedAt ?? b.updatedAt) - +new Date(a.purchasedAt ?? a.updatedAt))
    .map((item) => toItemView(item, now));

  return {
    id: list.id,
    name: list.name,
    description: list.description,
    color: list.color,
    icon: list.icon,
    ownerId: list.ownerId,
    isArchived: list.isArchived,
    isShared: members.length > 1,
    myRole: mine?.role ?? 'viewer',
    notifyOnChange: mine?.notifyOnChange ?? true,
    memberCount: members.length,
    pendingCount: pending.length,
    purchasedCount: purchased.length,
    overdueCount: items.filter((item) => isItemOverdue(item, now)).length,
    recurringCount: items.filter((item) => item.isRecurring).length,
    createdAt: new Date(list.createdAt).toISOString(),
    updatedAt: new Date(list.updatedAt).toISOString(),
    members,
    pending,
    purchased,
  };
};
