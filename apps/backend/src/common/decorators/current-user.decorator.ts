import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../types';

/** Inyecta el usuario autenticado que el JwtAuthGuard dejó en la request */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    return data && user ? user[data] : user;
  },
);
