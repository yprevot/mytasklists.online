import type { ListDetail, ListSummary, Member } from '@lista/contracts';
import { ItemStatus, ListMember, ShoppingList } from '../../database/entities';
import { isItemOverdue, toItemView } from '../items/item.mapper';

// Las formas publicas viven en el contrato compartido con los clientes
export type MemberView = Member;
export type ListSummaryView = ListSummary;
export type ListDetailView = ListDetail;

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
