import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { onUnauthorized, refreshSession, tokenStore } from '../api/client';
import { authApi, usersApi } from '../api/endpoints';
import { currentLanguage } from '../i18n';
import { isMfaChallenge, type AuthProviders, type AuthResponse, type User } from '../types';

/** Resultado del primer paso del login: sesión iniciada o reto de 2FA pendiente */
export type LoginStep = { status: 'done' } | { status: 'mfa'; mfaToken: string };

interface AuthContextValue {
  user: User | null;
  providers: AuthProviders;
  loading: boolean;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<LoginStep>;
  verifyMfa: (mfaToken: string, code: string) => Promise<void>;
  register: (payload: {
    fullName: string;
    email: string;
    whatsapp: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  /** Recupera la sesión desde la cookie (vuelta de Google/Apple o recarga) */
  restoreSession: () => Promise<boolean>;
  /** Adopta un par nuevo emitido por el backend (p. ej. tras cambiar la contraseña) */
  adoptSession: (result: AuthResponse) => void;
  refreshUser: () => Promise<void>;
  setUser: (user: User) => void;
  /** Olvida la sesión local sin llamar al backend (p. ej. tras borrar la cuenta) */
  forgetSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [providers, setProviders] = useState<AuthProviders>({
    local: true,
    google: import.meta.env.VITE_GOOGLE_ENABLED !== 'false',
    apple: import.meta.env.VITE_APPLE_ENABLED !== 'false',
  });

  const clearSession = useCallback(() => {
    tokenStore.clear();
    setAccessToken(null);
    setUserState(null);
  }, []);

  useEffect(() => onUnauthorized(clearSession), [clearSession]);

  // El backend escribe correos y avisos en `user.locale`: se iguala al idioma de la interfaz
  const { i18n } = useTranslation();
  useEffect(() => {
    const language = currentLanguage();
    if (!user || user.locale === language) return;
    usersApi
      .updateProfile({ locale: language })
      .then((updated) => setUserState((current) => (current ? { ...current, locale: updated.locale } : current)))
      .catch(() => undefined);
  }, [user, i18n.language]);

  useEffect(() => {
    authApi
      .providers()
      .then(setProviders)
      .catch(() => undefined);
  }, []);

  const adoptSession = useCallback((result: AuthResponse) => {
    tokenStore.save(result.accessToken);
    setAccessToken(result.accessToken);
    setUserState(result.user);
  }, []);

  const restoreSession = useCallback(async () => {
    const session = await refreshSession();
    if (!session) return false;
    setAccessToken(session.accessToken);
    // /auth/me incluye `hasPassword`, que la respuesta del refresh no trae
    setUserState(await authApi.me());
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      try {
        const restored = await restoreSession();
        if (!restored && !cancelled) clearSession();
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [clearSession, restoreSession]);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginStep> => {
      const result = await authApi.login(email, password);
      if (isMfaChallenge(result)) return { status: 'mfa', mfaToken: result.mfaToken };
      adoptSession(result);
      return { status: 'done' };
    },
    [adoptSession],
  );

  const verifyMfa = useCallback(
    async (mfaToken: string, code: string) => {
      adoptSession(await authApi.verifyMfa(mfaToken, code));
    },
    [adoptSession],
  );

  const register = useCallback(
    async (payload: { fullName: string; email: string; whatsapp: string; password: string }) => {
      adoptSession(await authApi.register(payload));
    },
    [adoptSession],
  );

  const refreshUser = useCallback(async () => {
    setUserState(await authApi.me());
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* la sesión se limpia igual aunque el backend no responda */
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      providers,
      loading,
      accessToken,
      login,
      verifyMfa,
      register,
      logout,
      restoreSession,
      adoptSession,
      refreshUser,
      setUser: setUserState,
      forgetSession: clearSession,
    }),
    [
      user,
      providers,
      loading,
      accessToken,
      login,
      verifyMfa,
      register,
      logout,
      restoreSession,
      adoptSession,
      refreshUser,
      clearSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
