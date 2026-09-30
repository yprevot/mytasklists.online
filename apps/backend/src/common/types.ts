import { UserRole } from '../database/entities';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  jti?: string;
  type?: 'access' | 'refresh';
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface RequestWithUser {
  user?: AuthenticatedUser;
  headers: Record<string, string | string[] | undefined>;
}
