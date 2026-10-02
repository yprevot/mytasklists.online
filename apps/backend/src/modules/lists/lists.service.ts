import { BillingService } from '../billing/billing.service';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { MailService } from '../mail/mail.service';
import { listInvitationTemplate } from '../mail/mail.templates';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  ActivityLog,
  InvitationStatus,
  ItemStatus,
  ListInvitation,
  ListItem,
  ListMember,
  MemberRole,
  NotificationType,
  ShoppingList,
  User,
} from '../../database/entities';
import { CacheService } from '../../redis/cache.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { RT } from '../realtime/realtime.events';
import { NotificationsService } from '../notifications/notifications.service';
import { isItemOverdue } from '../items/item.mapper';
import { ItemImageStorage } from '../items/item-image.storage';
import {
  ListDetailView,
  ListSummaryView,
  toListDetailView,
  toMemberView,
} from './list.mapper';
import { CreateListDto, ShareListDto, UpdateListDto, UpdateMemberDto } from './dto/list.dto';

const WRITE_ROLES = [MemberRole.OWNER, MemberRole.EDITOR];

@Injectable()
export class ListsService {
  private readonly logger = new Logger(ListsService.name);

  constructor(
    @InjectRepository(ShoppingList) private readonly lists: Repository<ShoppingList>,
    @InjectRepository(ListMember) private readonly members: Repository<ListMember>,
    @InjectRepository(ListInvitation) private readonly invitations: Repository<ListInvitation>,
    @InjectRepository(ListItem) private readonly items: Repository<ListItem>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ActivityLog) private readonly activity: Repository<ActivityLog>,
    private readonly cache: CacheService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
    private readonly billing: BillingService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly imageStorage: ItemImageStorage,
  ) {}

  // ── Permisos ────────────────────────────────────────────────────────
  /** Comprueba que el usuario pertenece a la lista y devuelve su membresía */
  async assertMember(listId: string, userId: string, writeAccess = false): Promise<ListMember> {
    const member = await this.members.findOne({ where: { listId, userId } });
    if (!member) throw new NotFoundException('La lista no existe o no tienes acceso a ella');
    if (writeAccess && !WRITE_ROLES.includes(member.role)) {
      throw new ForbiddenException('Solo puedes consultar esta lista');
    }
    return member;
  }

  private async assertOwner(listId: string, userId: string): Promise<ListMember> {
    const member = await this.members.findOne({ where: { listId, userId } });
    if (!member) throw new NotFoundException('La lista no existe o no tienes acceso a ella');
    if (member.role !== MemberRole.OWNER) {
      throw new ForbiddenException('Solo la persona propietaria puede hacer esto');
    }
    return member;
  }

  // ── Cache ───────────────────────────────────────────────────────────
  async invalidate(listId: string): Promise<void> {
    const memberIds = await this.members.find({ where: { listId }, select: { userId: true } });
    await this.cache.del(
      CacheService.listDetailKey(listId),
      ...memberIds.map((member) => CacheService.userListsKey(member.userId)),
    );
  }

  private async log(entry: Partial<ActivityLog>): Promise<void> {
    try {
      await this.activity.save(this.activity.create(entry));
    } catch (error) {
      this.logger.warn(`No se pudo escribir la bitácora: ${(error as Error).message}`);
    }
  }

  // ── Consultas ───────────────────────────────────────────────────────
  async findAllForUser(userId: string, includeArchived = false): Promise<ListSummaryView[]> {
    const memberships = await this.members.find({ where: { userId } });
    if (!memberships.length) return [];

    const listIds = memberships.map((member) => member.listId);
    const lists = await this.lists.find({
      where: { id: In(listIds) },
      relations: { members: { user: true }, items: true },
      order: { updatedAt: 'DESC' },
    });

    const now = new Date();
    return lists
      .filter((list) => includeArchived || !list.isArchived)
      .map((list) => {
        const mine = memberships.find((member) => member.listId === list.id)!;
        const items = list.items ?? [];
        return {
          id: list.id,
          name: list.name,
          description: list.description,
          color: list.color,
          icon: list.icon,
          ownerId: list.ownerId,
          isArchived: list.isArchived,
          isShared: (list.members ?? []).length > 1,
          myRole: mine.role,
          notifyOnChange: mine.notifyOnChange,
          memberCount: (list.members ?? []).length,
          pendingCount: items.filter((item) => item.status === ItemStatus.PENDING).length,
          purchasedCount: items.filter((item) => item.status === ItemStatus.PURCHASED).length,
          overdueCount: items.filter((item) => isItemOverdue(item, now)).length,
          recurringCount: items.filter((item) => item.isRecurring).length,
          createdAt: new Date(list.createdAt).toISOString(),
          updatedAt: new Date(list.updatedAt).toISOString(),
        };
      });
  }

  /** Carga la lista completa desde la base de datos (sin pasar por cache) */
  async loadDetail(listId: string): Promise<ShoppingList> {
    const list = await this.lists.findOne({
      where: { id: listId },
      relations: {
        members: { user: true },
        items: { purchasedBy: true, createdBy: true },
      },
    });
    if (!list) throw new NotFoundException('La lista no existe');
    return list;
  }

  async findOne(listId: string, userId: string): Promise<ListDetailView> {
    await this.assertMember(listId, userId);
    const list = await this.cache.wrap(CacheService.listDetailKey(listId), 30, async () =>
      this.loadDetail(listId),
    );
    // `wrap` puede devolver el objeto plano venido de Redis; el mapper lo tolera
    return toListDetailView(list as ShoppingList, userId);
  }

  // ── Escritura ───────────────────────────────────────────────────────
  async create(userId: string, dto: CreateListDto): Promise<ListDetailView> {
    const list = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))',['capacity:lists:'+userId]);
      await this.billing.assertCapacity(userId,'lists',await manager.count(ShoppingList,{where:{ownerId:userId}}));
      const created = await manager.save(
        manager.create(ShoppingList, {
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          color: dto.color ?? '#0d6efd',
          icon: dto.icon ?? '\u{1F6D2}',
          ownerId: userId,
        }),
      );
      await manager.save(
        manager.create(ListMember, {
          listId: created.id,
          userId,
          role: MemberRole.OWNER,
          notifyOnChange: true,
        }),
      );
      return created;
    });

    await this.cache.del(CacheService.userListsKey(userId));
    await this.log({ listId: list.id, userId, action: 'list.created', summary: list.name });
    await this.realtime.addUserToListRoom(userId, list.id);

    return this.findOne(list.id, userId);
  }

  async update(listId: string, userId: string, dto: UpdateListDto): Promise<ListDetailView> {
    await this.assertMember(listId, userId, true);
    const list = await this.lists.findOneOrFail({ where: { id: listId } });

    Object.assign(list, {
      name: dto.name?.trim() ?? list.name,
      description: dto.description !== undefined ? dto.description?.trim() || null : list.description,
      color: dto.color ?? list.color,
      icon: dto.icon ?? list.icon,
      isArchived: dto.isArchived ?? list.isArchived,
    });
    await this.lists.save(list);
    await this.invalidate(listId);

    const detail = await this.findOne(listId, userId);
    this.realtime.emitToList(listId, RT.LIST_UPDATED, { listId, list: detail, actorId: userId });
    await this.log({ listId, userId, action: 'list.updated', summary: list.name });
    return detail;
  }

  async remove(listId: string, userId: string): Promise<void> {
    await this.assertOwner(listId, userId);
    const list = await this.lists.findOneOrFail({ where: { id: listId } });
    const imageKeys = (await this.items.find({ where: { listId }, select: { imageKey: true } })).map((item) => item.imageKey);
    const memberIds = (await this.members.find({ where: { listId } })).map((m) => m.userId);

    await this.lists.remove(list);
    await Promise.allSettled(imageKeys.map((key) => this.imageStorage.remove(key)));
    await this.cache.del(
      CacheService.listDetailKey(listId),
      ...memberIds.map((id) => CacheService.userListsKey(id)),
    );
    this.realtime.emitToList(listId, RT.LIST_DELETED, { listId, actorId: userId });
    await this.log({ listId, userId, action: 'list.deleted', summary: list.name });
  }

  // ── Compartir ───────────────────────────────────────────────────────
  async share(listId: string, actorId: string, dto: ShareListDto): Promise<ListDetailView & { invitationSent?: boolean; invitationEmail?: string }> {
    await this.assertOwner(listId, actorId);
    if (!dto.email && !dto.userId) {
      throw new BadRequestException('Indica el correo o el id de la persona');
    }
    if (dto.role === MemberRole.OWNER) throw new BadRequestException('No se puede asignar la propiedad al compartir una lista');

    const target = dto.userId
      ? await this.users.findOne({ where: { id: dto.userId } })
      : await this.users
          .createQueryBuilder('user')
          .where('lower(user.email) = :email', { email: dto.email!.trim().toLowerCase() })
          .getOne();

    if (!target) {
      if (!dto.email) throw new NotFoundException('El usuario no existe');
      const email = dto.email!.trim().toLowerCase();
      const actor = await this.users.findOne({ where: { id: actorId } });
      if (actor?.email.toLowerCase() === email) throw new BadRequestException('Esta lista ya es tuya');
      await this.mail.assertAvailable();
      const list = await this.lists.findOneOrFail({ where: { id: listId } });
      const lifetimeHours = 72;
      const invite = await this.dataSource.transaction(async manager => {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`invite:${listId}:${email}`]);
        const repo = manager.getRepository(ListInvitation);
        let pending = await repo.createQueryBuilder('invite')
          .where('invite.listId = :listId AND lower(invite.email) = :email AND invite.status = :status',
            { listId, email, status: InvitationStatus.PENDING })
          .getOne();
        const token = randomBytes(32).toString('base64url');
        if (pending) {
          pending.token = token;
          pending.role = dto.role ?? MemberRole.EDITOR;
          pending.invitedById = actorId;
          pending.expiresAt = new Date(Date.now() + lifetimeHours * 3600_000);
        } else {
          pending = repo.create({
            listId, email, token, invitedById: actorId,
            role: dto.role ?? MemberRole.EDITOR, status: InvitationStatus.PENDING,
            expiresAt: new Date(Date.now() + lifetimeHours * 3600_000),
          });
        }
        return repo.save(pending);
      });
      const base = this.config.get<string>('publicUrl', 'http://localhost:8080').replace(/\/$/, '');
      const registrationUrl = `${base}/app/register?email=${encodeURIComponent(email)}`;
      try {
        await this.mail.send(email, listInvitationTemplate(actor?.locale ?? 'es', list.name, actor?.fullName ?? 'MyTaskLists', registrationUrl, lifetimeHours));
      } catch {
        await this.invitations.update({ id: invite.id, token: invite.token, status: InvitationStatus.PENDING }, { status: InvitationStatus.REVOKED });
        throw new BadRequestException('No se pudo enviar la invitación. Comprueba el correo e inténtalo de nuevo.');
      }
      return Object.assign(await this.findOne(listId, actorId), { invitationSent: true, invitationEmail: email });
    }
    if (target.id === actorId) throw new BadRequestException('Esta lista ya es tuya');

    const existing = await this.members.findOne({ where: { listId, userId: target.id } });
    if (existing) throw new BadRequestException('Esa persona ya forma parte de la lista');

    const member = await this.members.save(
      this.members.create({
        listId,
        userId: target.id,
        role: dto.role ?? MemberRole.EDITOR,
        notifyOnChange: true,
      }),
    );
    await this.invitations.update(
      { listId, email: target.email.toLowerCase(), status: InvitationStatus.PENDING },
      { status: InvitationStatus.ACCEPTED },
    );
    member.user = target;

    await this.invalidate(listId);
    await this.cache.del(CacheService.userListsKey(target.id));
    await this.realtime.addUserToListRoom(target.id, listId);

    const list = await this.lists.findOneOrFail({ where: { id: listId } });
    const actor = await this.users.findOne({ where: { id: actorId } });

    this.realtime.emitToList(listId, RT.LIST_MEMBER_ADDED, {
      listId,
      member: toMemberView(member),
      actorId,
    });

    await this.notifications.notifyListMembers({
      listId,
      listName: list.name,
      actorId,
      actorName: actor?.fullName,
      type: NotificationType.LIST_SHARED,
      render: (texts) => ({
        title: texts.listSharedTitle,
        body: texts.listShared(actor?.fullName, list.name),
      }),
      onlyUserIds: [target.id],
    });

    await this.log({
      listId,
      userId: actorId,
      action: 'list.shared',
      summary: `${list.name} → ${target.email}`,
      metadata: { targetUserId: target.id },
    });

    return this.findOne(listId, actorId);
  }

  async updateMember(
    listId: string,
    actorId: string,
    memberUserId: string,
    dto: UpdateMemberDto,
  ): Promise<ListDetailView> {
    const actorMember = await this.assertMember(listId, actorId);

    // Cada quien puede cambiar sus propias notificaciones; el rol solo lo cambia la persona propietaria
    if (memberUserId !== actorId && actorMember.role !== MemberRole.OWNER) {
      throw new ForbiddenException('Solo la persona propietaria puede modificar a otros integrantes');
    }
    if (dto.role !== undefined && actorMember.role !== MemberRole.OWNER) {
      throw new ForbiddenException('Solo la persona propietaria puede cambiar los roles');
    }

    const member = await this.members.findOne({ where: { listId, userId: memberUserId } });
    if (!member) throw new NotFoundException('Esa persona no forma parte de la lista');
    if (member.role === MemberRole.OWNER && dto.role && dto.role !== MemberRole.OWNER) {
      throw new BadRequestException('No puedes quitarle la propiedad a quien creó la lista');
    }

    if (dto.notifyOnChange !== undefined) member.notifyOnChange = dto.notifyOnChange;
    if (dto.role !== undefined) member.role = dto.role;
    await this.members.save(member);
    await this.invalidate(listId);

    const detail = await this.findOne(listId, actorId);
    this.realtime.emitToList(listId, RT.LIST_UPDATED, { listId, list: detail, actorId });
    return detail;
  }

  async removeMember(listId: string, actorId: string, memberUserId: string): Promise<void> {
    const actorMember = await this.assertMember(listId, actorId);
    const isSelf = actorId === memberUserId;
    if (!isSelf && actorMember.role !== MemberRole.OWNER) {
      throw new ForbiddenException('Solo la persona propietaria puede quitar integrantes');
    }

    const member = await this.members.findOne({
      where: { listId, userId: memberUserId },
      relations: { user: true },
    });
    if (!member) throw new NotFoundException('Esa persona no forma parte de la lista');
    if (member.role === MemberRole.OWNER) {
      throw new BadRequestException(
        'La persona propietaria no puede salirse de la lista; primero elimínala o transfiérela',
      );
    }

    await this.members.remove(member);
    await this.invalidate(listId);
    await this.cache.del(CacheService.userListsKey(memberUserId));
    await this.realtime.removeUserFromListRoom(memberUserId, listId);

    const list = await this.lists.findOneOrFail({ where: { id: listId } });
    this.realtime.emitToList(listId, RT.LIST_MEMBER_REMOVED, { listId, userId: memberUserId, actorId });
    this.realtime.emitToUser(memberUserId, RT.LIST_DELETED, { listId, actorId });

    await this.log({
      listId,
      userId: actorId,
      action: isSelf ? 'list.left' : 'list.member_removed',
      summary: `${list.name} → ${member.user?.email ?? memberUserId}`,
    });
  }

  // ── Utilidades para otros módulos ───────────────────────────────────
  async getListOrFail(listId: string): Promise<ShoppingList> {
    const list = await this.lists.findOne({ where: { id: listId } });
    if (!list) throw new NotFoundException('La lista no existe');
    return list;
  }

  async touch(listId: string): Promise<void> {
    await this.lists.update({ id: listId }, { updatedAt: new Date() });
  }
}
