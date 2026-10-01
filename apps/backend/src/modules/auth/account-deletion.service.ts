import { BillingService } from '../billing/billing.service';
import type { DeleteAccountRequest } from '@lista/contracts';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import {
  ActivityLog,
  AuthProvider,
  ListInvitation,
  ListMember,
  MemberRole,
  Notification,
  ShoppingList,
  User,
  UserIdentity,
} from '../../database/entities';
import { UsersService } from '../users/users.service';
import { CacheService } from '../../redis/cache.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { RT } from '../realtime/realtime.events';
import { MailService } from '../mail/mail.service';
import { accountDeletedTemplate } from '../mail/mail.templates';
import { TokenService } from './token.service';
import { MfaService } from './mfa.service';
import { OAuthService } from './oauth.service';

/**
 * Borrado de la cuenta a petición de la persona (App Store 5.1.1(v) y Google Play).
 *
 * Qué se borra:
 *  - La cuenta, sus identidades de Google/Apple, sus dispositivos y sus membresías
 *    (por cascada en la base de datos).
 *  - Las listas que creó, con sus productos e invitaciones, también para quienes las
 *    compartían.
 *  - Sus avisos, los avisos que otras personas recibieron por sus acciones (llevan
 *    su nombre en el texto), su bitácora y las invitaciones dirigidas a su correo.
 * En las listas de otras personas sus productos se conservan sin autor (SET NULL).
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly billing: BillingService,
    private readonly users: UsersService,
    private readonly mfa: MfaService,
    private readonly oauth: OAuthService,
    private readonly tokens: TokenService,
    private readonly cache: CacheService,
    private readonly realtime: RealtimeGateway,
    private readonly mail: MailService,
  ) {}

  async deleteAccount(userId: string, dto: DeleteAccountRequest): Promise<{ appleRevoked: boolean }> {
    const user = await this.users.findByIdWithSecrets(userId);

    // Confirmar la identidad: una sesión robada no basta para borrar la cuenta
    if (user.passwordHash) {
      if (!dto.password) throw new BadRequestException('Escribe tu contraseña para eliminar la cuenta');
      if (!(await this.users.validatePassword(user, dto.password))) {
        throw new BadRequestException('La contraseña no es correcta');
      }
    }
    if (user.totpEnabled) {
      if (!dto.mfaCode || !(await this.mfa.verifyCode(userId, dto.mfaCode))) {
        throw new BadRequestException('El código de verificación no es correcto');
      }
    }

    await this.billing.preventOrphanedBilling(userId);
    const appleRevoked = await this.revokeApple(user, dto.appleAuthorizationCode);

    const memberships = await this.dataSource.getRepository(ListMember).find({ where: { userId } });
    const ownedIds = memberships.filter((m) => m.role === MemberRole.OWNER).map((m) => m.listId);
    const joinedIds = memberships.filter((m) => m.role !== MemberRole.OWNER).map((m) => m.listId);
    const affectedLists = [...ownedIds, ...joinedIds];
    // Quienes ven esas listas: hay que limpiar su caché de "mis listas"
    const affectedUsers = affectedLists.length
      ? (
          await this.dataSource
            .getRepository(ListMember)
            .find({ where: { listId: In(affectedLists) }, select: { userId: true } })
        ).map((m) => m.userId)
      : [];

    await this.dataSource.transaction(async (manager) => {
      const notifications = manager
        .createQueryBuilder()
        .delete()
        .from(Notification)
        .where('user_id = :userId OR actor_id = :userId', { userId });
      if (ownedIds.length) notifications.orWhere('list_id IN (:...ownedIds)', { ownedIds });
      await notifications.execute();

      const activity = manager.createQueryBuilder().delete().from(ActivityLog).where('user_id = :userId', { userId });
      if (ownedIds.length) activity.orWhere('list_id IN (:...ownedIds)', { ownedIds });
      await activity.execute();

      await manager
        .createQueryBuilder()
        .delete()
        .from(ListInvitation)
        .where('LOWER(email) = LOWER(:email)', { email: user.email })
        .execute();
      await manager.update(ListInvitation, { invitedById: userId }, { invitedById: null });

      if (ownedIds.length) await manager.delete(ShoppingList, { id: In(ownedIds) });
      await manager.query('DELETE FROM registration_requests WHERE email=$1',[user.email]);
      await manager.delete(User, { id: userId });
    });

    await this.tokens.revokeAll(userId);
    await this.cache.del(
      CacheService.userListsKey(userId),
      ...affectedLists.map((listId) => CacheService.listDetailKey(listId)),
      ...[...new Set(affectedUsers)].map((id) => CacheService.userListsKey(id)),
    );
    for (const listId of ownedIds) {
      this.realtime.emitToList(listId, RT.LIST_DELETED, { listId, actorId: userId });
    }
    for (const listId of joinedIds) {
      this.realtime.emitToList(listId, RT.LIST_MEMBER_REMOVED, { listId, userId, actorId: userId });
    }
    await this.realtime.disconnectUser(userId);

    this.mail.sendInBackground(user.email, accountDeletedTemplate(user.locale, user.fullName));
    this.logger.log(
      `Cuenta ${userId} eliminada a petición propia (${ownedIds.length} listas propias, Apple revocado: ${appleRevoked})`,
    );
    return { appleRevoked };
  }

  /** Revoca Sign in with Apple si la cuenta lo tiene vinculado y la app mandó un código */
  private async revokeApple(user: User, code: string | undefined): Promise<boolean> {
    if (!code) return false;
    const identity = await this.dataSource
      .getRepository(UserIdentity)
      .findOne({ where: { userId: user.id, provider: AuthProvider.APPLE } });
    const subject = identity?.subject ?? (user.provider === AuthProvider.APPLE ? user.providerId : null);
    if (!subject) return false;
    return this.oauth.revokeAppleAuthorization(code, subject);
  }
}
