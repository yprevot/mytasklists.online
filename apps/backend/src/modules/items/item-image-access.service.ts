import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AuthStateService } from '../../redis/auth-state.service';
import { AuthenticatedUser } from '../../common/types';

interface ImageGrant { sub: string; sv: number; key: string; exp: number; }

@Injectable()
export class ItemImageAccessService {
  constructor(private readonly jwt: JwtService, private readonly config: ConfigService,
    private readonly db: DataSource, private readonly authState: AuthStateService) {}

  sign(key: string, user: AuthenticatedUser): string {
    // Stable within a minute; scoped to the session and filename. Never stored in shared cache.
    const exp = Math.floor(Date.now() / 60000) * 60 + 600;
    const token = this.jwt.sign({ sub: user.id, sv: user.sessionVersion ?? 0, key, exp }, {
      secret: this.config.get<string>('jwt.accessSecret'), audience: 'item-image', noTimestamp: true,
    });
    return `/items/images/${key}?grant=${token}`;
  }

  async authorize(key: string, grant?: string): Promise<void> {
    if (!grant || grant.length > 2048) throw new UnauthorizedException('Falta el permiso para ver la imagen');
    let payload: ImageGrant;
    try { payload = await this.jwt.verifyAsync<ImageGrant>(grant, {
      secret: this.config.get<string>('jwt.accessSecret'), audience: 'item-image',
    }); } catch { throw new UnauthorizedException('El permiso de la imagen expiró'); }
    if (payload.key !== key || !(await this.authState.isTokenAllowed(payload.sub, payload.sv)))
      throw new UnauthorizedException('El permiso de la imagen no es válido');
    const [allowed] = await this.db.query(`SELECT i.id FROM list_items i
      JOIN list_members m ON m.list_id=i.list_id AND m.user_id=$2
      WHERE i.image_key=$1 LIMIT 1`, [key, payload.sub]);
    if (!allowed) throw new NotFoundException('La imagen no existe o ya no tienes acceso');
  }
}
