// Las formas de la API viven en el contrato compartido con el backend y la app movil
import type { LoginResponse, MfaChallenge } from '@lista/contracts';

export type {
  AppNotification,
  AuthProviders,
  AuthResponse,
  Item,
  ItemStatus,
  ListDetail,
  ListSummary,
  LoginResponse,
  Member,
  MemberRole,
  MfaChallenge,
  User,
} from '@lista/contracts';

export const isMfaChallenge = (value: LoginResponse): value is MfaChallenge =>
  'mfaRequired' in value && value.mfaRequired === true;
