import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { onSessionExpired, tokens } from '../api/client';
import { authApi, usersApi } from '../api/endpoints';
import { currentLanguage } from '../i18n';
import type { AuthResponse, LoginResponse, User } from '../types';

/** Sesión iniciada o reto de 2FA pendiente */
export type LoginStep = { status: 'done' } | { status: 'mfa'; mfaToken: string };

interface Value {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginStep>;
  verifyMfa: (mfaToken: string, code: string) => Promise<void>;
  register: (payload: {
    fullName: string;
    email: string;
    whatsapp: string;
    password: string;
  }) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<LoginStep>;
  loginWithApple: (identityToken: string, fullName?: string) => Promise<LoginStep>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  /** Olvida la sesión local sin llamar al backend (p. ej. tras borrar la cuenta) */
  forgetSession: () => Promise<void>;
}

const AuthContext = createContext<Value | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clear = useCallback(() => {
    setUser(null);
    setAccessToken(null);
  }, []);

  useEffect(() => onSessionExpired(clear), [clear]);

  // El backend escribe correos y push en `user.locale`: se iguala al idioma de la app
  const { i18n } = useTranslation();
  useEffect(() => {
    const language = currentLanguage();
    if (!user || user.locale === language) return;
    usersApi
      .updateProfile({ locale: language })
      .then((updated) => setUser((current) => (current ? { ...current, locale: updated.locale } : current)))
      .catch(() => undefined);
  }, [user, i18n.language]);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      await tokens.load();
      if (!tokens.access) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const me = await authApi.me();
        if (!cancelled) {
          setUser(me);
          setAccessToken(tokens.access);
        }
      } catch {
        await tokens.clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const adopt = useCallback(async (result: AuthResponse) => {
    await tokens.save(result.accessToken, result.refreshToken);
    setAccessToken(result.accessToken);
    setUser(result.user);
  }, []);

  const handle = useCallback(
    async (result: LoginResponse): Promise<LoginStep> => {
      if ('mfaRequired' in result) return { status: 'mfa', mfaToken: result.mfaToken };
      await adopt(result);
      return { status: 'done' };
    },
    [adopt],
  );

  const value = useMemo<Value>(
    () => ({
      user,
      accessToken,
      loading,
      login: async (email, password) => handle(await authApi.login(email, password)),
      verifyMfa: async (mfaToken, code) => adopt(await authApi.verifyMfa(mfaToken, code)),
      register: async (payload) => adopt(await authApi.register(payload)),
      loginWithGoogle: async (idToken) => handle(await authApi.google(idToken)),
      loginWithApple: async (identityToken, fullName) =>
        handle(await authApi.apple(identityToken, fullName)),
      refreshUser: async () => setUser(await authApi.me()),
      logout: async () => {
        try {
          await authApi.logout(tokens.refresh);
        } catch {
          /* la sesión local se limpia igualmente */
        }
        await tokens.clear();
        clear();
      },
      forgetSession: async () => {
        await tokens.clear();
        clear();
      },
    }),
    [user, accessToken, loading, adopt, handle, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Value {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
