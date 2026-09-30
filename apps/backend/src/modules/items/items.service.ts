import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ActivityLog,
  ItemStatus,
  ListItem,
  NotificationType,
  ShoppingList,
  User,
} from '../../database/entities';
import { ListsService } from '../lists/lists.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { RT } from '../realtime/realtime.events';
import { NotificationsService } from '../notifications/notifications.service';
import { addDays, ItemView, toItemView } from './item.mapper';
import { CreateItemDto, ReorderItemsDto, UpdateItemDto } from './dto/item.dto';

@Injectable()
export class ItemsService {
  private readonly logger = new Logger(ItemsService.name);

  constructor(
    @InjectRepository(ListItem) private readonly items: Repository<ListItem>,
    @InjectRepository(ShoppingList) private readonly lists: Repository<ShoppingList>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ActivityLog) private readonly activity: Repository<ActivityLog>,
    private readonly listsService: ListsService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Helpers ─────────────────────────────────────────────────────────
  private async loadItem(itemId: string): Promise<ListItem> {
    const item = await this.items.findOne({
      where: { id: itemId },
      relations: { purchasedBy: true, createdBy: true },
    });
    if (!item) throw new NotFoundException('El producto no existe');
    return item;
  }

  private async actorName(userId: string): Promise<string> {
    const user = await this.users.findOne({ where: { id: userId }, select: { fullName: true } });
    return user?.fullName ?? 'Alguien';
  }

  private async afterChange(
    listId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.listsService.invalidate(listId);
    await this.listsService.touch(listId);
    this.realtime.emitToList(listId, event, { listId, ...payload });
  }

  private async log(entry: Partial<ActivityLog>): Promise<void> {
    try {
      await this.activity.save(this.activity.create(entry));
    } catch (error) {
      this.logger.warn(`No se pudo escribir la bitacora: ${(error as Error).message}`);
    }
  }

  // ── Alta ────────────────────────────────────────────────────────────
  async create(listId: string, userId: string, dto: CreateItemDto): Promise<ItemView> {
    await this.listsService.assertMember(listId, userId, true);
    const list = await this.listsService.getListOrFail(listId);

    const isRecurring = dto.isRecurring === true;
    if (isRecurring && !dto.recurrenceDays) {
      throw new BadRequestException('Indica cada cuantos dias debe volver a aparecer el producto');
    }

    const now = new Date();
    const maxOrder = await this.items
      .createQueryBuilder('item')
      .select('COALESCE(MAX(item.sortOrder), 0)', 'max')
      .where('item.listId = :listId', { listId })
      .getRawOne<{ max: string }>();

    const item = await this.items.save(
      this.items.create({
        listId,
        name: dto.name.trim(),
        quantity: dto.quantity ?? 1,
        unit: dto.unit?.trim() || 'pza',
        note: dto.note?.trim() || null,
        category: dto.category?.trim() || 'general',
        status: ItemStatus.PENDING,
        isRecurring,
        recurrenceDays: isRecurring ? dto.recurrenceDays! : null,
        activatedAt: now,
        // La fecha limite del primer ciclo se cuenta desde que se agrega el producto
        dueAt: isRecurring ? addDays(now, dto.recurrenceDays!) : null,
        nextActivationAt: null,
        createdById: userId,
        sortOrder: parseInt(maxOrder?.max ?? '0', 10) + 1,
      }),
    );

    const view = toItemView(await this.loadItem(item.id));
    await this.afterChange(listId, RT.ITEM_CREATED, { item: view, actorId: userId });

    const actorName = await this.actorName(userId);
    await this.notifications.notifyListMembers({
      listId,
      listName: list.name,
      itemId: item.id,
      actorId: userId,
      actorName,
      excludeUserId: userId,
      type: NotificationType.ITEM_ADDED,
      title: list.name,
      body: `${actorName} agrego "${item.name}"${
        isRecurring ? ` (se repite cada ${item.recurrenceDays} dias)` : ''
      }`,
      payload: { itemName: item.name, isRecurring },
    });

    await this.log({
      listId,
      userId,
      itemId: item.id,
      action: 'item.created',
      summary: item.name,
      metadata: { isRecurring, recurrenceDays: item.recurrenceDays },
    });

    return view;
  }

  // ── Edicion ─────────────────────────────────────────────────────────
  async update(itemId: string, userId: string, dto: UpdateItemDto): Promise<ItemView> {
    const item = await this.loadItem(itemId);
    await this.listsService.assertMember(item.listId, userId, true);

    if (dto.name !== undefined) item.name = dto.name.trim();
    if (dto.quantity !== undefined) item.quantity = dto.quantity;
    if (dto.unit !== undefined) item.unit = dto.unit.trim();
    if (dto.note !== undefined) item.note = dto.note?.trim() || null;
    if (dto.category !== undefined) item.category = dto.category.trim();

    // Cambiar la recurrencia recalcula la fecha limite del ciclo en curso
    if (dto.isRecurring !== undefined || dto.recurrenceDays !== undefined) {
      const isRecurring = dto.isRecurring ?? item.isRecurring;
      const days = dto.recurrenceDays ?? item.recurrenceDays;
      if (isRecurring && !days) {
        throw new BadRequestException('Indica cada cuantos dias debe volver a aparecer el producto');
      }
      item.isRecurring = isRecurring;
      item.recurrenceDays = isRecurring ? days! : null;
      item.overdueNotifiedAt = null;

      if (isRecurring) {
        const base = item.status === ItemStatus.PENDING ? new Date(item.activatedAt) : new Date();
        item.dueAt = addDays(base, days!);
        if (item.status !== ItemStatus.PENDING && item.lastPurchasedAt) {
          item.nextActivationAt = addDays(new Date(item.lastPurchasedAt), days!);
        }
      } else {
        item.dueAt = null;
        item.nextActivationAt = null;
      }
    }

    await this.items.save(item);
    const view = toItemView(await this.loadItem(itemId));
    await this.afterChange(item.listId, RT.ITEM_UPDATED, { item: view, actorId: userId });

    const list = await this.listsService.getListOrFail(item.listId);
    const actorName = await this.actorName(userId);
    await this.notifications.notifyListMembers({
      listId: item.listId,
      listName: list.name,
      itemId: item.id,
      actorId: userId,
      actorName,
      excludeUserId: userId,
      type: NotificationType.ITEM_UPDATED,
      title: list.name,
      body: `${actorName} edito "${item.name}"`,
    });

    await this.log({ listId: item.listId, userId, itemId, action: 'item.updated', summary: item.name });
    return view;
  }

  // ── Marcar como comprado ────────────────────────────────────────────
  /**
   * Al marcar el producto como comprado pasa a la lista de abajo (tachado) y,
   * si es recurrente, se programa su reaparicion contando los dias de
   * recurrencia **desde el momento de la compra**.
   *
   * Ej.: "Pan de caja" agregado el lunes con recurrencia de 14 dias y comprado
   * el viernes vuelve a activarse 14 dias despues de ese viernes.
   */
  async purchase(itemId: string, userId: string): Promise<ItemView> {
    const item = await this.loadItem(itemId);
    await this.listsService.assertMember(item.listId, userId, true);

    if (item.status === ItemStatus.PURCHASED) return toItemView(item);

    const now = new Date();
    item.status = ItemStatus.PURCHASED;
    item.purchasedAt = now;
    item.lastPurchasedAt = now;
    item.purchasedById = userId;
    item.overdueNotifiedAt = null;
    item.nextActivationAt =
      item.isRecurring && item.recurrenceDays ? addDays(now, item.recurrenceDays) : null;

    await this.items.save(item);
    const view = toItemView(await this.loadItem(itemId));
    await this.afterChange(item.listId, RT.ITEM_PURCHASED, { item: view, actorId: userId });

    const list = await this.listsService.getListOrFail(item.listId);
    const actorName = await this.actorName(userId);
    await this.notifications.notifyListMembers({
      listId: item.listId,
      listName: list.name,
      itemId: item.id,
      actorId: userId,
      actorName,
      excludeUserId: userId,
      type: NotificationType.ITEM_PURCHASED,
      title: list.name,
      body: `${actorName} ya compro "${item.name}"`,
      payload: {
        itemName: item.name,
        nextActivationAt: item.nextActivationAt?.toISOString() ?? null,
      },
    });

    await this.log({
      listId: item.listId,
      userId,
      itemId,
      action: 'item.purchased',
      summary: item.name,
      metadata: { nextActivationAt: item.nextActivationAt },
    });

    return view;
  }

  /** Deshace la compra: el producto regresa a la lista de pendientes */
  async restore(itemId: string, userId: string): Promise<ItemView> {
    const item = await this.loadItem(itemId);
    await this.listsService.assertMember(item.listId, userId, true);

    item.status = ItemStatus.PENDING;
    item.purchasedAt = null;
    item.purchasedById = null;
    item.nextActivationAt = null;
    item.overdueNotifiedAt = null;
    if (item.isRecurring && item.recurrenceDays) {
      item.dueAt = addDays(new Date(item.activatedAt), item.recurrenceDays);
    }

    await this.items.save(item);
    const view = toItemView(await this.loadItem(itemId));
    await this.afterChange(item.listId, RT.ITEM_RESTORED, { item: view, actorId: userId });

    const list = await this.listsService.getListOrFail(item.listId);
    const actorName = await this.actorName(userId);
    await this.notifications.notifyListMembers({
      listId: item.listId,
      listName: list.name,
      itemId: item.id,
      actorId: userId,
      actorName,
      excludeUserId: userId,
      type: NotificationType.ITEM_RESTORED,
      title: list.name,
      body: `${actorName} regreso "${item.name}" a la lista de pendientes`,
    });

    await this.log({ listId: item.listId, userId, itemId, action: 'item.restored', summary: item.name });
    return view;
  }

  // ── Quitar de la lista de comprados con la "x" ──────────────────────
  /**
   * Cierra la tarjeta de la lista de abajo. Si el producto es recurrente
   * conserva su programacion y volvera a aparecer cuando toque.
   */
  async archive(itemId: string, userId: string): Promise<{ id: string; listId: string }> {
    const item = await this.loadItem(itemId);
    await this.listsService.assertMember(item.listId, userId, true);

    item.status = ItemStatus.ARCHIVED;
    await this.items.save(item);
    await this.afterChange(item.listId, RT.ITEM_REMOVED, {
      itemId,
      actorId: userId,
      permanent: false,
      willReturnAt: item.nextActivationAt?.toISOString() ?? null,
    });

    await this.log({ listId: item.listId, userId, itemId, action: 'item.archived', summary: item.name });
    return { id: itemId, listId: item.listId };
  }

  /** Borra el producto por completo (tambien cancela su recurrencia) */
  async remove(itemId: string, userId: string): Promise<{ id: string; listId: string }> {
    const item = await this.loadItem(itemId);
    await this.listsService.assertMember(item.listId, userId, true);
    const { listId, name } = item;

    await this.items.remove(item);
    await this.afterChange(listId, RT.ITEM_REMOVED, { itemId, actorId: userId, permanent: true });

    const list = await this.listsService.getListOrFail(listId);
    const actorName = await this.actorName(userId);
    await this.notifications.notifyListMembers({
      listId,
      listName: list.name,
      actorId: userId,
      actorName,
      excludeUserId: userId,
      type: NotificationType.ITEM_REMOVED,
      title: list.name,
      body: `${actorName} elimino "${name}"`,
    });

    await this.log({ listId, userId, itemId, action: 'item.removed', summary: name });
    return { id: itemId, listId };
  }

  /** Vacia de golpe la lista de comprados */
  async clearPurchased(listId: string, userId: string): Promise<{ cleared: number }> {
    await this.listsService.assertMember(listId, userId, true);
    const purchased = await this.items.find({ where: { listId, status: ItemStatus.PURCHASED } });
    if (!purchased.length) return { cleared: 0 };

    await this.items.update(
      { id: In(purchased.map((item) => item.id)) },
      { status: ItemStatus.ARCHIVED },
    );
    await this.afterChange(listId, RT.LIST_UPDATED, {
      actorId: userId,
      clearedItemIds: purchased.map((item) => item.id),
    });
    await this.log({
      listId,
      userId,
      action: 'list.cleared_purchased',
      summary: `${purchased.length} productos`,
    });
    return { cleared: purchased.length };
  }

  async reorder(listId: string, userId: string, dto: ReorderItemsDto): Promise<{ ok: boolean }> {
    await this.listsService.assertMember(listId, userId, true);
    await Promise.all(
      dto.itemIds.map((id, index) => this.items.update({ id, listId }, { sortOrder: index + 1 })),
    );
    await this.afterChange(listId, RT.LIST_UPDATED, { actorId: userId, reordered: dto.itemIds });
    return { ok: true };
  }

  async findByList(listId: string, userId: string, status?: ItemStatus): Promise<ItemView[]> {
    await this.listsService.assertMember(listId, userId);
    const items = await this.items.find({
      where: { listId, ...(status ? { status } : {}) },
      relations: { purchasedBy: true, createdBy: true },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    const now = new Date();
    return items
      .filter((item) => status !== undefined || item.status !== ItemStatus.ARCHIVED)
      .map((item) => toItemView(item, now));
  }
}
