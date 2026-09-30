import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; socketUrl?: string };

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ??
  extra.apiUrl ??
  'http://localhost:8080/api'
).replace(/\/$/, '');

export const SOCKET_URL = (
  process.env.EXPO_PUBLIC_SOCKET_URL ??
  extra.socketUrl ??
  API_URL.replace(/\/api$/, '')
).replace(/\/$/, '');

const KEYS = { access: 'lc.mobile.access', refresh: 'lc.mobile.refresh' };

let accessToken: string | null = null;
let refreshToken: string | null = null;

export const tokens = {
  get access() {
    return accessToken;
  },
  get refresh() {
    return refreshToken;
  },
  async load(): Promise<void> {
    const [[, access], [, refresh]] = await AsyncStorage.multiGet([KEYS.access, KEYS.refresh]);
    accessToken = access;
    refreshToken = refresh;
  },
  async save(access: string, refresh: string): Promise<void> {
    accessToken = access;
    refreshToken = refresh;
    await AsyncStorage.multiSet([
      [KEYS.access, access],
      [KEYS.refresh, refresh],
    ]);
  },
  async clear(): Promise<void> {
    accessToken = null;
    refreshToken = null;
    await AsyncStorage.multiRemove([KEYS.access, KEYS.refresh]);
  },
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const listeners = new Set<() => void>();
export const onSessionExpired = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

let refreshing: Promise<boolean> | null = null;

async function renew(): Promise<boolean> {
  if (refreshing) return refreshing;
  if (!refreshToken) return false;

  refreshing = (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) return false;
      const data = await response.json();
      await tokens.save(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

interface Options {
  method?: string;
  body?: unknown;
  auth?: boolean;
  retry?: boolean;
}

export async function request<T>(path: string, options: Options = {}): Promise<T> {
  const { method = 'GET', body, auth = true, retry = true } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && auth && retry) {
    if (await renew()) return request<T>(path, { ...options, retry: false });
    await tokens.clear();
    listeners.forEach((listener) => listener());
    throw new ApiError('Tu sesion expiro', 401);
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const raw = payload?.message;
    throw new ApiError(
      Array.isArray(raw) ? raw.join('. ') : (raw ?? 'Ocurrio un error inesperado'),
      response.status,
    );
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: 'POST', body, auth }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
