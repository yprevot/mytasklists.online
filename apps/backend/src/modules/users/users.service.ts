import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AuthProvider, User, UserIdentity } from '../../database/entities';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface CreateUserInput {
  fullName: string;
  email: string;
  whatsapp?: string | null;
  password?: string;
  provider?: AuthProvider;
  providerId?: string | null;
  avatarUrl?: string | null;
  emailVerified?: boolean;
}

export interface SocialLoginInput {
  provider: AuthProvider.GOOGLE | AuthProvider.APPLE;
  subject: string;
  email: string;
  /** El proveedor confirmo que el correo pertenece a esta cuenta */
  emailVerified: boolean;
  /** El correo es un marcador generado por nosotros (Apple sin correo) */
  syntheticEmail?: boolean;
  fullName: string;
  avatarUrl?: string | null;
  whatsapp?: string | null;
}

export interface SocialLoginResult {
  user: User;
  /** Se borro una contrasena nunca verificada al vincular (posible pre-secuestro) */
  droppedUnverifiedPassword: boolean;
}

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
    @InjectRepository(UserIdentity)
    private readonly identities: Repository<UserIdentity>,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async findByEmail(email: string, withPassword = false): Promise<User | null> {
    const query = this.repo
      .createQueryBuilder('user')
      .where('lower(user.email) = :email', { email: this.normalizeEmail(email) });
    if (withPassword) query.addSelect('user.passwordHash');
    return query.getOne();
  }

  async findById(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  /** Igual que findById pero con los campos sensibles (hash y 2FA) cargados */
  async findByIdWithSecrets(id: string): Promise<User> {
    const user = await this.repo
      .createQueryBuilder('user')
      .addSelect(['user.passwordHash', 'user.totpSecret', 'user.totpRecoveryCodes'])
      .where('user.id = :id', { id })
      .getOne();
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async hasPassword(userId: string): Promise<boolean> {
    const row = await this.repo
      .createQueryBuilder('user')
      .select('user.id')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: userId })
      .getOne();
    return Boolean(row?.passwordHash);
  }

  async create(input: CreateUserInput): Promise<User> {
    const email = this.normalizeEmail(input.email);
    const existing = await this.findByEmail(email);
    if (existing) throw new BadRequestException('Ya existe una cuenta con este correo electronico');

    const user = this.repo.create({
      fullName: input.fullName.trim(),
      email,
      whatsapp: input.whatsapp ?? null,
      passwordHash: input.password ? await bcrypt.hash(input.password, BCRYPT_ROUNDS) : null,
      provider: input.provider ?? AuthProvider.LOCAL,
      providerId: input.providerId ?? null,
      avatarUrl: input.avatarUrl ?? null,
      emailVerified: input.emailVerified ?? false,
    });
    return this.repo.save(user);
  }

  /**
   * Resuelve el usuario de un inicio de sesion con Google o Apple.
   *
   * 1. Si esa cuenta del proveedor (`sub`) ya esta vinculada, entra ese usuario.
   * 2. Si hay un usuario con el mismo correo, solo se vincula cuando el
   *    proveedor garantiza que el correo es suyo. Si la cuenta local tenia una
   *    contrasena que nadie verifico, se elimina: pudo ponerla un atacante que
   *    registro el correo de la victima antes que ella (pre-secuestro).
   * 3. Si no existe, se crea con el correo ya verificado.
   */
  async resolveSocialLogin(input: SocialLoginInput): Promise<SocialLoginResult> {
    const linked = await this.identities.findOne({
      where: { provider: input.provider, subject: input.subject },
    });
    if (linked) {
      await this.identities.update(
        { id: linked.id },
        { lastUsedAt: new Date(), email: input.syntheticEmail ? linked.email : input.email },
      );
      const user = await this.findById(linked.userId);
      if (!user.avatarUrl && input.avatarUrl) {
        user.avatarUrl = input.avatarUrl;
        await this.repo.update({ id: user.id }, { avatarUrl: input.avatarUrl });
      }
      return { user, droppedUnverifiedPassword: false };
    }

    const email = this.normalizeEmail(input.email);
    const existing = input.syntheticEmail ? null : await this.findByEmail(email, true);

    if (existing) {
      if (!input.emailVerified) {
        throw new ConflictException(
          'Ya existe una cuenta con este correo y el proveedor no confirmo que te pertenece. ' +
            'Inicia sesion con tu contrasena.',
        );
      }
      const droppedUnverifiedPassword = Boolean(existing.passwordHash) && !existing.emailVerified;
      await this.repo.update(
        { id: existing.id },
        {
          emailVerified: true,
          ...(droppedUnverifiedPassword ? { passwordHash: null } : {}),
          ...(!existing.avatarUrl && input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
          ...(!existing.providerId ? { providerId: input.subject } : {}),
        },
      );
      await this.linkIdentity(existing.id, input);
      return { user: await this.findById(existing.id), droppedUnverifiedPassword };
    }

    const user = await this.create({
      fullName: input.fullName,
      email,
      whatsapp: input.whatsapp ?? null,
      avatarUrl: input.avatarUrl ?? null,
      provider: input.provider,
      providerId: input.subject,
      emailVerified: input.emailVerified && !input.syntheticEmail,
    });
    await this.linkIdentity(user.id, input);
    return { user, droppedUnverifiedPassword: false };
  }

  private async linkIdentity(userId: string, input: SocialLoginInput): Promise<void> {
    await this.identities.save(
      this.identities.create({
        userId,
        provider: input.provider,
        subject: input.subject,
        email: input.syntheticEmail ? null : this.normalizeEmail(input.email),
        lastUsedAt: new Date(),
      }),
    );
  }

  async validatePassword(user: User, plain: string): Promise<boolean> {
    if (!user.passwordHash) return false;
    return bcrypt.compare(plain, user.passwordHash);
  }

  async touchLogin(userId: string): Promise<void> {
    await this.repo.update({ id: userId }, { lastLoginAt: new Date() });
  }

  async markEmailVerified(userId: string): Promise<User> {
    await this.repo.update({ id: userId }, { emailVerified: true });
    return this.findById(userId);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.findById(userId);
    Object.assign(user, {
      fullName: dto.fullName?.trim() ?? user.fullName,
      whatsapp: dto.whatsapp ?? user.whatsapp,
      avatarUrl: dto.avatarUrl ?? user.avatarUrl,
      notificationsEnabled: dto.notificationsEnabled ?? user.notificationsEnabled,
    });
    return this.repo.save(user);
  }

  /** Cambia la contrasena comprobando la actual si la cuenta ya tenia una */
  async changePassword(userId: string, currentPassword: string | undefined, newPassword: string) {
    const user = await this.findByIdWithSecrets(userId);
    if (user.passwordHash) {
      if (!currentPassword) throw new BadRequestException('Debes indicar tu contrasena actual');
      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) throw new BadRequestException('La contrasena actual no es correcta');
    }
    await this.setPassword(userId, newPassword);
    return user;
  }

  async setPassword(userId: string, newPassword: string): Promise<void> {
    await this.repo.update(
      { id: userId },
      { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
    );
  }

  async setTotp(
    userId: string,
    data: { secret: string | null; enabled: boolean; recoveryCodes: string[] | null },
  ): Promise<void> {
    await this.repo.update(
      { id: userId },
      { totpSecret: data.secret, totpEnabled: data.enabled, totpRecoveryCodes: data.recoveryCodes },
    );
  }

  async setRecoveryCodes(userId: string, recoveryCodes: string[]): Promise<void> {
    await this.repo.update({ id: userId }, { totpRecoveryCodes: recoveryCodes });
  }

  /**
   * Busqueda usada al compartir una lista. Solo acepta el correo exacto: asi no
   * sirve para listar a otras personas por nombre ni por fragmentos de correo.
   */
  async searchByExactEmail(term: string, excludeUserId?: string): Promise<User[]> {
    const email = this.normalizeEmail(term ?? '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return [];
    const user = await this.findByEmail(email);
    if (!user || !user.isActive || user.id === excludeUserId) return [];
    return [user];
  }

  async findAllPaginated(page: number, limit: number, search?: string) {
    const where = search
      ? [{ email: ILike(`%${search}%`) }, { fullName: ILike(`%${search}%`) }]
      : undefined;
    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
  }

  async setActive(userId: string, isActive: boolean): Promise<User> {
    const user = await this.findById(userId);
    user.isActive = isActive;
    return this.repo.save(user);
  }

  async count(): Promise<number> {
    return this.repo.count();
  }

  get repository(): Repository<User> {
    return this.repo;
  }
}
