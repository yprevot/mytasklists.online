import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { onSessionExpired, tokens } from '../api/client';
import { authApi } from '../api/endpoints';
import type { User } from '../types';

interface Value {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    fullName: string;
    email: string;
    whatsapp: string;
    password: string;
  }) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginWithApple: (identityToken: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
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

  const adopt = useCallback(
    async (result: { accessToken: string; refreshToken: string; user: User }) => {
      await tokens.save(result.accessToken, result.refreshToken);
      setAccessToken(result.accessToken);
      setUser(result.user);
    },
    [],
  );

  const value = useMemo<Value>(
    () => ({
      user,
      accessToken,
      loading,
      login: async (email, password) => adopt(await authApi.login(email, password)),
      register: async (payload) => adopt(await authApi.register(payload)),
      loginWithGoogle: async (idToken) => adopt(await authApi.google(idToken)),
      loginWithApple: async (identityToken, fullName) =>
        adopt(await authApi.apple(identityToken, fullName)),
      logout: async () => {
        try {
          await authApi.logout(tokens.refresh);
        } catch {
          /* la sesion local se limpia igualmente */
        }
        await tokens.clear();
        clear();
      },
    }),
    [user, accessToken, loading, adopt, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Value {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
