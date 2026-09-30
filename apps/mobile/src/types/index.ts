// Las formas de la API viven en el contrato compartido con el backend y la web
import type { AuthResponse as ContractAuthResponse, MfaChallenge } from '@lista/contracts';

export type {
  AppCompatibility,
  AppNotification,
  AppUpdateRequiredError,
  Item,
  ItemStatus,
  ListDetail,
  ListSummary,
  Member,
  MfaChallenge,
  User,
} from '@lista/contracts';

/** La app movil no usa cookies: el refresh token siempre llega en el cuerpo */
export type AuthResponse = ContractAuthResponse & { refreshToken: string };

export type LoginResponse = AuthResponse | MfaChallenge;
