import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  ActivityLog,
  AuthProvider,
  ItemStatus,
  ListItem,
  ListMember,
  MemberRole,
  ShoppingList,
  User,
  UserRole,
} from '../entities';

const DAY = 86400000;
const days = (n: number): Date => new Date(Date.now() + n * DAY);

export const SEED_ACCOUNTS = {
  admin: { email: 'admin@listadecompras.mx', password: 'Admin12345', fullName: 'Administracion' },
  ana: { email: 'ana@example.com', password: 'Demo12345', fullName: 'Ana Lopez Garcia' },
  carlos: { email: 'carlos@example.com', password: 'Demo12345', fullName: 'Carlos Ramirez Diaz' },
};

/**
 * Carga datos de demostracion. Es idempotente: si el usuario administrador ya
 * existe no vuelve a escribir nada, asi que se puede dejar activado en cada
 * arranque del contenedor.
 */
export async function runSeed(dataSource: DataSource): Promise<string> {
  const users = dataSource.getRepository(User);
  const lists = dataSource.getRepository(ShoppingList);
  const members = dataSource.getRepository(ListMember);
  const items = dataSource.getRepository(ListItem);
  const activity = dataSource.getRepository(ActivityLog);

  const alreadySeeded = await users.findOne({ where: { email: SEED_ACCOUNTS.admin.email } });
  if (alreadySeeded) return 'los datos de demostracion ya estaban cargados';

  const hash = (plain: string) => bcrypt.hash(plain, 10);

  const admin = await users.save(
    users.create({
      fullName: SEED_ACCOUNTS.admin.fullName,
      email: SEED_ACCOUNTS.admin.email,
      whatsapp: '+5215500000000',
      passwordHash: await hash(SEED_ACCOUNTS.admin.password),
      provider: AuthProvider.LOCAL,
      role: UserRole.ADMIN,
      emailVerified: true,
    }),
  );

  const ana = await users.save(
    users.create({
      fullName: SEED_ACCOUNTS.ana.fullName,
      email: SEED_ACCOUNTS.ana.email,
      whatsapp: '+5215511112222',
      passwordHash: await hash(SEED_ACCOUNTS.ana.password),
      provider: AuthProvider.LOCAL,
      emailVerified: true,
    }),
  );

  const carlos = await users.save(
    users.create({
      fullName: SEED_ACCOUNTS.carlos.fullName,
      email: SEED_ACCOUNTS.carlos.email,
      whatsapp: '+5215533334444',
      passwordHash: await hash(SEED_ACCOUNTS.carlos.password),
      provider: AuthProvider.LOCAL,
      emailVerified: true,
    }),
  );

  // ── Lista compartida entre Ana y Carlos ─────────────────────────────
  const despensa = await lists.save(
    lists.create({
      name: 'Despensa quincenal',
      description: 'Lo que compramos cada quince dias en el super',
      color: '#0d6efd',
      icon: '\u{1F6D2}',
      ownerId: ana.id,
    }),
  );

  await members.save([
    members.create({ listId: despensa.id, userId: ana.id, role: MemberRole.OWNER, notifyOnChange: true }),
    members.create({
      listId: despensa.id,
      userId: carlos.id,
      role: MemberRole.EDITOR,
      notifyOnChange: true,
    }),
  ]);

  await items.save([
    // Producto recurrente en curso: se agrego hace 3 dias y vence en 11
    items.create({
      listId: despensa.id,
      name: 'Pan de caja',
      quantity: 1,
      unit: 'pza',
      category: 'panaderia',
      status: ItemStatus.PENDING,
      isRecurring: true,
      recurrenceDays: 14,
      activatedAt: days(-3),
      dueAt: days(11),
      createdById: ana.id,
      sortOrder: 1,
    }),
    // Producto recurrente VENCIDO: la interfaz lo pinta de otro color
    items.create({
      listId: despensa.id,
      name: 'Leche entera',
      quantity: 2,
      unit: 'l',
      category: 'lacteos',
      status: ItemStatus.PENDING,
      isRecurring: true,
      recurrenceDays: 7,
      activatedAt: days(-10),
      dueAt: days(-3),
      createdById: carlos.id,
      sortOrder: 2,
    }),
    // Producto de una sola vez
    items.create({
      listId: despensa.id,
      name: 'Pilas AA',
      quantity: 4,
      unit: 'pza',
      category: 'hogar',
      status: ItemStatus.PENDING,
      isRecurring: false,
      activatedAt: days(-1),
      createdById: ana.id,
      sortOrder: 3,
    }),
    // Ya comprado: aparece tachado en la lista de abajo
    items.create({
      listId: despensa.id,
      name: 'Cafe molido',
      quantity: 1,
      unit: 'kg',
      category: 'abarrotes',
      status: ItemStatus.PURCHASED,
      isRecurring: true,
      recurrenceDays: 21,
      activatedAt: days(-8),
      dueAt: days(13),
      purchasedAt: days(-2),
      lastPurchasedAt: days(-2),
      purchasedById: carlos.id,
      nextActivationAt: days(19),
      cycleCount: 1,
      createdById: ana.id,
      sortOrder: 4,
    }),
  ]);

  // ── Lista personal de Carlos ────────────────────────────────────────
  const ferreteria = await lists.save(
    lists.create({
      name: 'Ferreteria',
      description: 'Pendientes del proyecto de la terraza',
      color: '#fd7e14',
      icon: '\u{1F528}',
      ownerId: carlos.id,
    }),
  );
  await members.save(
    members.create({
      listId: ferreteria.id,
      userId: carlos.id,
      role: MemberRole.OWNER,
      notifyOnChange: true,
    }),
  );
  await items.save([
    items.create({
      listId: ferreteria.id,
      name: 'Tornillos 1/4',
      quantity: 20,
      unit: 'pza',
      category: 'ferreteria',
      createdById: carlos.id,
      sortOrder: 1,
    }),
    items.create({
      listId: ferreteria.id,
      name: 'Cinta de aislar',
      quantity: 2,
      unit: 'pza',
      category: 'ferreteria',
      createdById: carlos.id,
      sortOrder: 2,
    }),
  ]);

  await activity.save([
    activity.create({
      listId: despensa.id,
      userId: ana.id,
      action: 'list.created',
      summary: despensa.name,
    }),
    activity.create({
      listId: despensa.id,
      userId: ana.id,
      action: 'list.shared',
      summary: `${despensa.name} → ${carlos.email}`,
    }),
    activity.create({
      listId: despensa.id,
      userId: carlos.id,
      action: 'item.purchased',
      summary: 'Cafe molido',
    }),
  ]);

  return `3 usuarios (${admin.email}, ${ana.email}, ${carlos.email}), 2 listas y 6 productos`;
}
