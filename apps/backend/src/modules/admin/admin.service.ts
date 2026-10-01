import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ActivityLog,
  AuthProvider,
  ItemStatus,
  ListItem,
  ListMember,
  Notification,
  ShoppingList,
  User,
} from '../../database/entities';
import { CacheService } from '../../redis/cache.service';

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

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ShoppingList) private readonly lists: Repository<ShoppingList>,
    @InjectRepository(ListMember) private readonly members: Repository<ListMember>,
    @InjectRepository(ListItem) private readonly items: Repository<ListItem>,
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    @InjectRepository(ActivityLog) private readonly activity: Repository<ActivityLog>,
    private readonly cache: CacheService,
  ) {}

  async stats(): Promise<AdminStats> {
    return this.cache.wrap('admin:stats', 15, async () => {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

      const [totalUsers, activeUsers, newUsers] = await Promise.all([
        this.users.count(),
        this.users.count({ where: { isActive: true } }),
        this.users
          .createQueryBuilder('user')
          .where('user.createdAt >= :since', { since: sevenDaysAgo })
          .getCount(),
      ]);

      const providerRows = await this.users
        .createQueryBuilder('user')
        .select('user.provider', 'provider')
        .addSelect('COUNT(*)', 'count')
        .groupBy('user.provider')
        .getRawMany<{ provider: AuthProvider; count: string }>();

      const [totalLists, archivedLists] = await Promise.all([
        this.lists.count(),
        this.lists.count({ where: { isArchived: true } }),
      ]);

      const sharedRow = await this.members
        .createQueryBuilder('member')
        .select('member.list_id', 'listId')
        .groupBy('member.list_id')
        .having('COUNT(*) > 1')
        .getRawMany();

      const [total, pending, purchased, archived, recurring] = await Promise.all([
        this.items.count(),
        this.items.count({ where: { status: ItemStatus.PENDING } }),
        this.items.count({ where: { status: ItemStatus.PURCHASED } }),
        this.items.count({ where: { status: ItemStatus.ARCHIVED } }),
        this.items.count({ where: { isRecurring: true } }),
      ]);

      const overdue = await this.items
        .createQueryBuilder('item')
        .where('item.status = :status', { status: ItemStatus.PENDING })
        .andWhere('item.isRecurring = true')
        .andWhere('item.dueAt IS NOT NULL AND item.dueAt < now()')
        .getCount();

      const purchasedToday = await this.items
        .createQueryBuilder('item')
        .where('item.purchasedAt >= :since', { since: startOfToday })
        .getCount();

      const [totalNotifications, unreadNotifications] = await Promise.all([
        this.notifications.count(),
        this.notifications.count({ where: { isRead: false } }),
      ]);

      return {
        users: {
          total: totalUsers,
          active: activeUsers,
          newLast7Days: newUsers,
          byProvider: Object.fromEntries(
            providerRows.map((row) => [row.provider, parseInt(row.count, 10)]),
          ),
        },
        lists: {
          total: totalLists,
          shared: sharedRow.length,
          archived: archivedLists,
          averageItems: totalLists ? Math.round((total / totalLists) * 10) / 10 : 0,
        },
        items: { total, pending, purchased, archived, recurring, overdue, purchasedToday },
        notifications: { total: totalNotifications, unread: unreadNotifications },
        generatedAt: now.toISOString(),
      };
    });
  }

  /** Serie diaria de altas y compras para las gráficas del dashboard */
  async timeseries(days = 14) {
    const since = new Date(Date.now() - days * 86400000);

    const created = await this.items
      .createQueryBuilder('item')
      .select("to_char(date_trunc('day', item.createdAt), 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(*)', 'count')
      .where('item.createdAt >= :since', { since })
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany<{ day: string; count: string }>();

    const purchased = await this.items
      .createQueryBuilder('item')
      .select("to_char(date_trunc('day', item.purchasedAt), 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(*)', 'count')
      .where('item.purchasedAt >= :since', { since })
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany<{ day: string; count: string }>();

    const signups = await this.users
      .createQueryBuilder('user')
      .select("to_char(date_trunc('day', user.createdAt), 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(*)', 'count')
      .where('user.createdAt >= :since', { since })
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany<{ day: string; count: string }>();

    const index = (rows: { day: string; count: string }[]) =>
      Object.fromEntries(rows.map((row) => [row.day, parseInt(row.count, 10)]));

    const createdIdx = index(created);
    const purchasedIdx = index(purchased);
    const signupsIdx = index(signups);

    const series: { day: string; created: number; purchased: number; signups: number }[] = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = new Date(Date.now() - offset * 86400000);
      const day = date.toISOString().slice(0, 10);
      series.push({
        day,
        created: createdIdx[day] ?? 0,
        purchased: purchasedIdx[day] ?? 0,
        signups: signupsIdx[day] ?? 0,
      });
    }
    return series;
  }

  async recentActivity(limit = 40) {
    const rows = await this.activity.find({ order: { createdAt: 'DESC' }, take: limit });
    const userIds = [...new Set(rows.map((row) => row.userId).filter(Boolean))] as string[];
    const users = userIds.length
      ? await this.users
          .createQueryBuilder('user')
          .where('user.id IN (:...ids)', { ids: userIds })
          .getMany()
      : [];
    const nameById = new Map(users.map((user) => [user.id, user.fullName]));

    const listIds = [...new Set(rows.map((row) => row.listId).filter(Boolean))] as string[];
    const lists = listIds.length
      ? await this.lists
          .createQueryBuilder('list')
          .where('list.id IN (:...ids)', { ids: listIds })
          .getMany()
      : [];
    const listById = new Map(lists.map((list) => [list.id, list.name]));

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      summary: row.summary,
      metadata: row.metadata,
      createdAt: row.createdAt,
      userId: row.userId,
      userName: row.userId ? (nameById.get(row.userId) ?? 'Usuario eliminado') : 'Sistema',
      listId: row.listId,
      listName: row.listId ? (listById.get(row.listId) ?? 'Lista eliminada') : null,
    }));
  }

  async listsPaginated(page: number, limit: number, search?: string) {
    const query = this.lists
      .createQueryBuilder('list')
      .leftJoinAndSelect('list.owner', 'owner')
      .orderBy('list.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      query.where('LOWER(list.name) LIKE :search OR LOWER(owner.email) LIKE :search', {
        search: `%${search.toLowerCase()}%`,
      });
    }

    const [data, total] = await query.getManyAndCount();
    const ids = data.map((list) => list.id);
    const [memberCount, itemCount] = await Promise.all([
      this.countByList(this.members, ids),
      this.countByList(this.items, ids),
    ]);
    return {
      data: data.map((list) => ({
        id: list.id,
        name: list.name,
        color: list.color,
        icon: list.icon,
        isArchived: list.isArchived,
        ownerName: list.owner?.fullName ?? '—',
        ownerEmail: list.owner?.email ?? '—',
        memberCount: memberCount.get(list.id) ?? 0,
        itemCount: itemCount.get(list.id) ?? 0,
        createdAt: list.createdAt,
        updatedAt: list.updatedAt,
      })),
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /** Cuenta filas por lista (integrantes o productos) de una página de listas */
  private async countByList(
    repo: Repository<ListMember> | Repository<ListItem>,
    listIds: string[],
  ): Promise<Map<string, number>> {
    if (!listIds.length) return new Map();
    const rows = await (repo as Repository<ListMember>)
      .createQueryBuilder('row')
      .select('row.listId', 'listId')
      .addSelect('COUNT(*)', 'count')
      .where('row.listId IN (:...listIds)', { listIds })
      .groupBy('row.listId')
      .getRawMany<{ listId: string; count: string }>();
    return new Map(rows.map((row) => [row.listId, Number(row.count)]));
  }
}
