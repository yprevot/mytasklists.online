import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { onUnauthorized, tokenStore } from '../api/client';
import { authApi } from '../api/endpoints';
import type { AuthProviders, User } from '../types';

interface AuthContextValue {
  user: User | null;
  providers: AuthProviders;
  loading: boolean;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    fullName: string;
    email: string;
    whatsapp: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  adoptTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(tokenStore.access);
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

  useEffect(() => {
    authApi
      .providers()
      .then(setProviders)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      if (!tokenStore.access) {
        setLoading(false);
        return;
      }
      try {
        const me = await authApi.me();
        if (!cancelled) {
          setUserState(me);
          setAccessToken(tokenStore.access);
        }
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
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    tokenStore.save(result.accessToken, result.refreshToken);
    setAccessToken(result.accessToken);
    setUserState(result.user);
  }, []);

  const register = useCallback(
    async (payload: { fullName: string; email: string; whatsapp: string; password: string }) => {
      const result = await authApi.register(payload);
      tokenStore.save(result.accessToken, result.refreshToken);
      setAccessToken(result.accessToken);
      setUserState(result.user);
    },
    [],
  );

  const adoptTokens = useCallback(async (access: string, refresh: string) => {
    tokenStore.save(access, refresh);
    setAccessToken(access);
    setUserState(await authApi.me());
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout(tokenStore.refresh);
    } catch {
      /* la sesion se limpia igual aunque el backend no responda */
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
      register,
      logout,
      adoptTokens,
      setUser: setUserState,
    }),
    [user, providers, loading, accessToken, login, register, logout, adoptTokens],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
