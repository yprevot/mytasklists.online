import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import {
  ActivityLog,
  ItemStatus,
  ListItem,
  NotificationType,
  ShoppingList,
} from '../../database/entities';
import { ListsService } from '../lists/lists.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { RT } from '../realtime/realtime.events';
import { NotificationsService } from '../notifications/notifications.service';
import { addDays, DAY_MS, toItemView } from '../items/item.mapper';

export interface SweepResult {
  reactivated: number;
  overdue: number;
  ranAt: string;
}

/**
 * Motor de recurrencia.
 *
 * Cada pasada hace dos cosas:
 *
 *  1. **Reactivar**: los productos recurrentes cuya fecha `next_activation_at`
 *     ya llego vuelven a la lista de pendientes. Esa fecha se calculo al
 *     marcarlos como comprados (fecha de compra + dias de recurrencia).
 *
 *  2. **Marcar vencidos**: los productos recurrentes que siguen pendientes y
 *     ya pasaron su `due_at` se avisan una sola vez; la interfaz los pinta con
 *     un color distinto mientras sigan sin comprarse.
 */
@Injectable()
export class RecurrenceService implements OnModuleInit {
  private readonly logger = new Logger(RecurrenceService.name);
  static readonly JOB_NAME = 'recurrence-sweep';

  constructor(
    @InjectRepository(ListItem) private readonly items: Repository<ListItem>,
    @InjectRepository(ShoppingList) private readonly lists: Repository<ShoppingList>,
    @InjectRepository(ActivityLog) private readonly activity: Repository<ActivityLog>,
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
    private readonly listsService: ListsService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    const expression = this.config.get<string>('recurrence.cron', '0 */5 * * * *');
    const job = new CronJob(expression, () => {
      void this.runSweep().catch((error) =>
        this.logger.error(`Fallo la pasada de recurrencia: ${(error as Error).message}`),
      );
    });
    this.scheduler.addCronJob(RecurrenceService.JOB_NAME, job as any);
    job.start();
    this.logger.log(`Motor de recurrencia programado con la expresion "${expression}"`);
  }

  async runSweep(now: Date = new Date()): Promise<SweepResult> {
    const reactivated = await this.reactivateDue(now);
    const overdue = await this.flagOverdue(now);
    if (reactivated || overdue) {
      this.logger.log(`Recurrencia: ${reactivated} reactivados, ${overdue} vencidos`);
    }
    return { reactivated, overdue, ranAt: now.toISOString() };
  }

  // ── 1. Reactivacion ─────────────────────────────────────────────────
  private async reactivateDue(now: Date): Promise<number> {
    const due = await this.items.find({
      where: {
        isRecurring: true,
        nextActivationAt: LessThanOrEqual(now),
        status: Not(ItemStatus.PENDING),
      },
      relations: { purchasedBy: true, createdBy: true },
      take: 500,
    });
    if (!due.length) return 0;

    for (const item of due) {
      const days = item.recurrenceDays ?? 0;
      if (days <= 0) {
        item.nextActivationAt = null;
        await this.items.save(item);
        continue;
      }

      item.status = ItemStatus.PENDING;
      item.activatedAt = now;
      item.dueAt = addDays(now, days);
      item.purchasedAt = null;
      item.purchasedById = null;
      item.purchasedBy = null;
      item.nextActivationAt = null;
      item.overdueNotifiedAt = null;
      item.cycleCount += 1;
      await this.items.save(item);

      const list = await this.lists.findOne({ where: { id: item.listId } });
      if (!list) continue;

      const view = toItemView(item, now);
      await this.listsService.invalidate(item.listId);
      this.realtime.emitToList(item.listId, RT.ITEM_REACTIVATED, {
        listId: item.listId,
        item: view,
        actorId: null,
      });

      await this.notifications.notifyListMembers({
        listId: item.listId,
        listName: list.name,
        itemId: item.id,
        type: NotificationType.ITEM_REACTIVATED,
        render: (texts) => ({ title: list.name, body: texts.itemReactivated(item.name, days) }),
        payload: { itemName: item.name, cycle: item.cycleCount },
      });

      await this.activity.save(
        this.activity.create({
          listId: item.listId,
          itemId: item.id,
          action: 'item.reactivated',
          summary: item.name,
          metadata: { cycle: item.cycleCount, recurrenceDays: days },
        }),
      );
    }
    return due.length;
  }

  // ── 2. Vencidos ─────────────────────────────────────────────────────
  private async flagOverdue(now: Date): Promise<number> {
    const overdue = await this.items.find({
      where: {
        isRecurring: true,
        status: ItemStatus.PENDING,
        dueAt: LessThanOrEqual(now),
        overdueNotifiedAt: IsNull(),
      },
      relations: { purchasedBy: true, createdBy: true },
      take: 500,
    });
    if (!overdue.length) return 0;

    for (const item of overdue) {
      item.overdueNotifiedAt = now;
      await this.items.save(item);

      const list = await this.lists.findOne({ where: { id: item.listId } });
      if (!list) continue;

      const daysLate = Math.max(
        1,
        Math.floor((now.getTime() - new Date(item.dueAt!).getTime()) / DAY_MS) + 1,
      );

      await this.listsService.invalidate(item.listId);
      this.realtime.emitToList(item.listId, RT.ITEM_OVERDUE, {
        listId: item.listId,
        item: toItemView(item, now),
      });

      await this.notifications.notifyListMembers({
        listId: item.listId,
        listName: list.name,
        itemId: item.id,
        type: NotificationType.ITEM_OVERDUE,
        render: (texts) => ({ title: list.name, body: texts.itemOverdue(item.name, daysLate) }),
        payload: { itemName: item.name, daysLate },
      });
    }
    return overdue.length;
  }

  // ── Utilidad de pruebas / demo ──────────────────────────────────────
  /**
   * "Viaja en el tiempo" un producto restando `days` a todas sus fechas.
   * Permite comprobar la recurrencia sin esperar dias reales; se puede
   * desactivar con ALLOW_TIME_TRAVEL=false.
   */
  async advanceItem(itemId: string, userId: string, days: number): Promise<SweepResult> {
    const item = await this.items.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('El producto no existe');
    await this.listsService.assertMember(item.listId, userId, true);

    const shift = (date: Date | null): Date | null =>
      date ? new Date(new Date(date).getTime() - days * DAY_MS) : null;

    item.activatedAt = shift(item.activatedAt)!;
    item.dueAt = shift(item.dueAt);
    item.nextActivationAt = shift(item.nextActivationAt);
    item.purchasedAt = shift(item.purchasedAt);
    item.lastPurchasedAt = shift(item.lastPurchasedAt);
    item.overdueNotifiedAt = null;
    await this.items.save(item);

    await this.listsService.invalidate(item.listId);
    return this.runSweep();
  }
}
