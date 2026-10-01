import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { User } from '../../database/entities';

export const ADMIN_MFA_REQUIRED = 'ADMIN_MFA_REQUIRED';

/**
 * Las operaciones de administración exigen que la cuenta tenga la verificación en
 * dos pasos activa (`ADMIN_REQUIRE_MFA`, obligatoria por defecto en producción). Una
 * contraseña filtrada no basta para ver usuarios, listas ni la bitácora. Sin 2FA la
 * respuesta lleva `code: ADMIN_MFA_REQUIRED` y el panel manda a activarla.
 * Va después de JwtAuthGuard y RolesGuard, que ya dejaron `request.user`.
 */
@Injectable()
export class AdminMfaGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    if (!this.config.get<boolean>('adminRequireMfa', true)) return true;

    const { user } = context.switchToHttp().getRequest();
    const account = user?.id
      ? await this.dataSource
          .getRepository(User)
          .findOne({ where: { id: user.id }, select: { id: true, totpEnabled: true } })
      : null;
    if (account?.totpEnabled) return true;

    throw new ForbiddenException({
      error: 'Forbidden',
      message: 'Activa la verificación en dos pasos para usar el panel de administración',
      code: ADMIN_MFA_REQUIRED,
    });
  }
}
