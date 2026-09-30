import type { AuthResponse } from '../types';

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

const STORAGE = {
  access: 'lc.accessToken',
  refresh: 'lc.refreshToken',
};

export const tokenStore = {
  get access(): string | null {
    return localStorage.getItem(STORAGE.access);
  },
  get refresh(): string | null {
    return localStorage.getItem(STORAGE.refresh);
  },
  save(accessToken: string, refreshToken: string): void {
    localStorage.setItem(STORAGE.access, accessToken);
    localStorage.setItem(STORAGE.refresh, refreshToken);
  },
  clear(): void {
    localStorage.removeItem(STORAGE.access);
    localStorage.removeItem(STORAGE.refresh);
  },
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();
export const onUnauthorized = (listener: Listener): (() => void) => {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
};

let refreshing: Promise<boolean> | null = null;

/** Renueva el par de tokens una sola vez aunque varias peticiones fallen a la vez */
async function refreshTokens(): Promise<boolean> {
  if (refreshing) return refreshing;
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return false;

  refreshing = (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) return false;
      const data = (await response.json()) as AuthResponse;
      tokenStore.save(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
  retry?: boolean;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, retry = true, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...((headers as Record<string, string>) ?? {}),
  };
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';
  if (auth && tokenStore.access) finalHeaders.Authorization = `Bearer ${tokenStore.access}`;

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && auth && retry) {
    const renewed = await refreshTokens();
    if (renewed) return request<T>(path, { ...options, retry: false });
    tokenStore.clear();
    unauthorizedListeners.forEach((listener) => listener());
    throw new ApiError('Tu sesion expiro. Vuelve a iniciar sesion.', 401);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const raw = payload?.message;
    const message = Array.isArray(raw) ? raw.join('. ') : (raw ?? 'Ocurrio un error inesperado');
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

export { API_URL };
