import type { AuthResponse } from '../types';

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

/**
 * El access token vive solo en memoria y el refresh token en una cookie
 * httpOnly que pone el backend (cabecera `X-Auth-Client: web`). Ningun token
 * queda en localStorage, asi que un XSS no puede llevarse la sesion.
 * Al recargar la pagina la sesion se recupera con /auth/refresh.
 */
const CLIENT_HEADERS = { 'X-Auth-Client': 'web' };

let accessToken: string | null = null;

// Limpieza de sesiones guardadas por versiones anteriores de la app
try {
  localStorage.removeItem('lc.accessToken');
  localStorage.removeItem('lc.refreshToken');
} catch {
  /* almacenamiento no disponible */
}

export const tokenStore = {
  get access(): string | null {
    return accessToken;
  },
  save(token: string): void {
    accessToken = token;
  },
  clear(): void {
    accessToken = null;
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

let refreshing: Promise<AuthResponse | null> | null = null;

async function callRefresh(): Promise<AuthResponse | null> {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...CLIENT_HEADERS },
    body: '{}',
  });
  if (!response.ok) return null;
  const data = (await response.json()) as AuthResponse;
  tokenStore.save(data.accessToken);
  return data;
}

/**
 * Renueva la sesion con la cookie. Una sola renovacion a la vez por pestana y,
 * con Web Locks, tambien entre pestanas: el refresh token rota en cada uso, asi
 * que dos pestanas renovando a la vez se invalidarian mutuamente.
 */
export async function refreshSession(): Promise<AuthResponse | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const locks = (navigator as Navigator & { locks?: LockManager }).locks;
      return locks ? await locks.request('lc-refresh', callRefresh) : await callRefresh();
    } catch {
      return null;
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
    ...CLIENT_HEADERS,
    ...((headers as Record<string, string>) ?? {}),
  };
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';
  if (auth && tokenStore.access) finalHeaders.Authorization = `Bearer ${tokenStore.access}`;

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: 'same-origin',
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && auth && retry) {
    const renewed = await refreshSession();
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
