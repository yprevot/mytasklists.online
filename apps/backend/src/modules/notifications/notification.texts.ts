import type { Locale } from '@lista/contracts';

/**
 * Textos de los avisos (pop-up en la web y push en el telefono). Se generan en el
 * idioma de quien los recibe, asi que los integrantes de una misma lista pueden
 * leerlos cada uno en el suyo.
 */
const es = {
  itemAdded: (actor: string, item: string, repeatDays: number | null) =>
    `${actor} agrego "${item}"${repeatDays ? ` (se repite cada ${repeatDays} dias)` : ''}`,
  itemUpdated: (actor: string, item: string) => `${actor} edito "${item}"`,
  itemPurchased: (actor: string, item: string) => `${actor} ya compro "${item}"`,
  itemRestored: (actor: string, item: string) => `${actor} regreso "${item}" a la lista de pendientes`,
  itemRemoved: (actor: string, item: string) => `${actor} elimino "${item}"`,
  itemReactivated: (item: string, days: number) => `"${item}" volvio a tu lista (se repite cada ${days} dias)`,
  itemOverdue: (item: string, daysLate: number) =>
    `"${item}" lleva ${daysLate} dia(s) sin comprarse y ya vencio su ciclo`,
  listSharedTitle: 'Nueva lista compartida contigo',
  listShared: (actor: string | undefined, list: string) =>
    `${actor ?? 'Alguien'} compartio contigo la lista "${list}"`,
};

const en: typeof es = {
  itemAdded: (actor, item, repeatDays) =>
    `${actor} added "${item}"${repeatDays ? ` (repeats every ${repeatDays} days)` : ''}`,
  itemUpdated: (actor, item) => `${actor} edited "${item}"`,
  itemPurchased: (actor, item) => `${actor} bought "${item}"`,
  itemRestored: (actor, item) => `${actor} moved "${item}" back to the to-buy list`,
  itemRemoved: (actor, item) => `${actor} deleted "${item}"`,
  itemReactivated: (item, days) => `"${item}" is back on your list (repeats every ${days} days)`,
  itemOverdue: (item, daysLate) =>
    `"${item}" has gone ${daysLate} day${daysLate === 1 ? '' : 's'} without being bought and is overdue`,
  listSharedTitle: 'A list was shared with you',
  listShared: (actor, list) => `${actor ?? 'Someone'} shared the list "${list}" with you`,
};

export const NOTIFICATION_TEXTS: Record<Locale, typeof es> = { es, en };
