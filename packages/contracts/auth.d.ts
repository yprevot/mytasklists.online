import type { User } from './models';

export interface AuthResponse {
  accessToken: string;
  /** En la web y el panel viaja en una cookie httpOnly y no llega en el cuerpo */
  refreshToken?: string;
  expiresIn: string;
  tokenType: 'Bearer';
  user: User;
}

/** El login devuelve un reto cuando la cuenta tiene verificacion en dos pasos */
export interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string;
}

export type LoginResponse = AuthResponse | MfaChallenge;
