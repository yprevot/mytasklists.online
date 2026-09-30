import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AuthProvider, User } from '../../database/entities';
import { ChangePasswordDto, UpdateProfileDto } from './dto/update-profile.dto';

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

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
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

  async create(input: CreateUserInput): Promise<User> {
    const email = this.normalizeEmail(input.email);
    const existing = await this.findByEmail(email);
    if (existing) throw new BadRequestException('Ya existe una cuenta con este correo electronico');

    const user = this.repo.create({
      fullName: input.fullName.trim(),
      email,
      whatsapp: input.whatsapp ?? null,
      passwordHash: input.password ? await bcrypt.hash(input.password, 12) : null,
      provider: input.provider ?? AuthProvider.LOCAL,
      providerId: input.providerId ?? null,
      avatarUrl: input.avatarUrl ?? null,
      emailVerified: input.emailVerified ?? false,
    });
    return this.repo.save(user);
  }

  /** Enlaza una cuenta social a un usuario existente o crea uno nuevo */
  async findOrCreateFromProvider(input: CreateUserInput & { provider: AuthProvider }): Promise<User> {
    const email = this.normalizeEmail(input.email);
    const existing = await this.findByEmail(email);
    if (existing) {
      let dirty = false;
      if (!existing.providerId && input.providerId) {
        existing.providerId = input.providerId;
        existing.provider = input.provider;
        dirty = true;
      }
      if (!existing.avatarUrl && input.avatarUrl) {
        existing.avatarUrl = input.avatarUrl;
        dirty = true;
      }
      if (!existing.emailVerified) {
        existing.emailVerified = true;
        dirty = true;
      }
      return dirty ? this.repo.save(existing) : existing;
    }
    return this.create({ ...input, emailVerified: true });
  }

  async validatePassword(user: User, plain: string): Promise<boolean> {
    if (!user.passwordHash) return false;
    return bcrypt.compare(plain, user.passwordHash);
  }

  async touchLogin(userId: string): Promise<void> {
    await this.repo.update({ id: userId }, { lastLoginAt: new Date() });
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

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.repo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: userId })
      .getOne();
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (user.passwordHash) {
      if (!dto.currentPassword) throw new BadRequestException('Debes indicar tu contrasena actual');
      const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!ok) throw new BadRequestException('La contrasena actual no es correcta');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.repo.save(user);
  }

  /** Busqueda usada al compartir una lista */
  async search(term: string, excludeUserId?: string): Promise<User[]> {
    if (!term || term.trim().length < 3) return [];
    const value = `%${term.trim().toLowerCase()}%`;
    const query = this.repo
      .createQueryBuilder('user')
      .where('(lower(user.email) LIKE :value OR lower(user.fullName) LIKE :value)', { value })
      .andWhere('user.isActive = true')
      .limit(10);
    if (excludeUserId) query.andWhere('user.id != :excludeUserId', { excludeUserId });
    return query.getMany();
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
