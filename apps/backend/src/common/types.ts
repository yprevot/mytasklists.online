import { UserRole } from '../database/entities';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  jti?: string;
  type?: 'access' | 'refresh';
  /** Versión de sesión al emitirse (ver AuthStateService) */
  sv?: number;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  sessionVersion?: number;
  id: string;
  email: string;
  role: UserRole;
}

export interface RequestWithUser {
  user?: AuthenticatedUser;
  headers: Record<string, string | string[] | undefined>;
}
