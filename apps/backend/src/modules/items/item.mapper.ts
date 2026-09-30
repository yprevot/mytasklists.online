import { ItemStatus, ListItem } from '../../database/entities';

export const DAY_MS = 24 * 60 * 60 * 1000;

export const addDays = (from: Date, days: number): Date => new Date(from.getTime() + days * DAY_MS);

/** Dias completos entre dos fechas (positivo si `b` es posterior a `a`) */
export const daysBetween = (a: Date, b: Date): number =>
  Math.floor((b.getTime() - a.getTime()) / DAY_MS);

/** Dias que faltan, redondeando hacia arriba: hoy mismo + 14 dias muestra "14" */
const daysAhead = (from: Date, to: Date): number =>
  Math.max(0, Math.ceil((to.getTime() - from.getTime()) / DAY_MS));

/**
 * Un producto recurrente esta "vencido" cuando sigue pendiente y ya se paso la
 * fecha limite de su ciclo. La interfaz lo pinta con otro color.
 */
export const isItemOverdue = (item: ListItem, now: Date = new Date()): boolean =>
  item.status === ItemStatus.PENDING &&
  item.isRecurring &&
  item.dueAt !== null &&
  now.getTime() > new Date(item.dueAt).getTime();

export interface ItemView {
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

export const toItemView = (item: ListItem, now: Date = new Date()): ItemView => {
  const overdue = isItemOverdue(item, now);
  const dueAt = item.dueAt ? new Date(item.dueAt) : null;
  const nextActivationAt = item.nextActivationAt ? new Date(item.nextActivationAt) : null;

  return {
    id: item.id,
    listId: item.listId,
    name: item.name,
    quantity: Number(item.quantity),
    unit: item.unit,
    note: item.note,
    category: item.category,
    status: item.status,
    isRecurring: item.isRecurring,
    recurrenceDays: item.recurrenceDays,
    activatedAt: new Date(item.activatedAt).toISOString(),
    dueAt: dueAt ? dueAt.toISOString() : null,
    nextActivationAt: nextActivationAt ? nextActivationAt.toISOString() : null,
    purchasedAt: item.purchasedAt ? new Date(item.purchasedAt).toISOString() : null,
    purchasedById: item.purchasedById,
    purchasedByName: item.purchasedBy?.fullName ?? null,
    lastPurchasedAt: item.lastPurchasedAt ? new Date(item.lastPurchasedAt).toISOString() : null,
    cycleCount: item.cycleCount,
    createdById: item.createdById,
    createdByName: item.createdBy?.fullName ?? null,
    sortOrder: item.sortOrder,
    createdAt: new Date(item.createdAt).toISOString(),
    updatedAt: new Date(item.updatedAt).toISOString(),
    isOverdue: overdue,
    daysOverdue: overdue && dueAt ? Math.max(1, daysBetween(dueAt, now)) : 0,
    daysUntilDue: dueAt && !overdue ? daysAhead(now, dueAt) : null,
    daysUntilReactivation: nextActivationAt ? daysAhead(now, nextActivationAt) : null,
  };
};
