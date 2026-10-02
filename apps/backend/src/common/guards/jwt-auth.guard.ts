import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayload } from '../types';
import { AuthStateService } from '../../redis/auth-state.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly authState: AuthStateService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Socket.IO se autentica en el handshake (RealtimeGateway) y no trae cabeceras HTTP
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const header: string | undefined =
      request?.headers?.authorization ?? request?.headers?.Authorization;

    if (!header || !header.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Falta el token de acceso');
    }

    const token = header.slice(7).trim();
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Tipo de token inválido');
    }

    // Cuenta desactivada o sesiones revocadas (cambio de contraseña, logout global)
    if (!(await this.authState.isTokenAllowed(payload.sub, payload.sv))) {
      throw new UnauthorizedException('La sesión ya no es válida. Vuelve a iniciar sesión.');
    }

    request.user = { id: payload.sub, email: payload.email, role: payload.role, sessionVersion: payload.sv };
    return true;
  }
}
