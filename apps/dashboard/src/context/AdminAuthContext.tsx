import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, refreshSession, tokenStore } from '../api/client';
import { adminApi, type AdminSession } from '../api/endpoints';
import type { AdminUser } from '../types';

export type AdminLoginStep = { status: 'done' } | { status: 'mfa'; mfaToken: string };

interface Value {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AdminLoginStep>;
  verifyMfa: (mfaToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  reloadUser: () => Promise<void>;
}

const AdminAuthContext = createContext<Value | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      try {
        if (!(await refreshSession())) return;
        const me = await adminApi.me();
        if (!cancelled) setUser(me.role === 'admin' ? me : null);
      } catch {
        tokenStore.clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const adopt = useCallback(async (session: AdminSession) => {
    if (session.user.role !== 'admin') {
      // La cookie ya se emitio: se revoca para no dejar una sesion abierta
      tokenStore.save(session.accessToken);
      await adminApi.logout().catch(() => undefined);
      tokenStore.clear();
      throw new ApiError('Esta cuenta no tiene acceso al panel de administracion', 403);
    }
    tokenStore.save(session.accessToken);
    setUser(session.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<AdminLoginStep> => {
      const result = await adminApi.login(email, password);
      if ('mfaRequired' in result) return { status: 'mfa', mfaToken: result.mfaToken };
      await adopt(result);
      return { status: 'done' };
    },
    [adopt],
  );

  const verifyMfa = useCallback(
    async (mfaToken: string, code: string) => adopt(await adminApi.verifyMfa(mfaToken, code)),
    [adopt],
  );

  const logout = useCallback(async () => {
    await adminApi.logout().catch(() => undefined);
    tokenStore.clear();
    setUser(null);
  }, []);

  const reloadUser = useCallback(async () => {
    setUser(await adminApi.me());
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, verifyMfa, logout, reloadUser }),
    [user, loading, login, verifyMfa, logout, reloadUser],
  );
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): Value {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth debe usarse dentro de AdminAuthProvider');
  return context;
}
