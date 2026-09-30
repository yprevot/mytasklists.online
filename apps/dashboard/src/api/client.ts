const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

/**
 * Igual que la app web: access token en memoria y refresh token en una cookie
 * httpOnly propia del panel (`X-Auth-Client: dashboard`), distinta de la de la
 * app para que entrar en uno no abra sesion en el otro.
 */
const CLIENT_HEADERS = { 'X-Auth-Client': 'dashboard' };

let accessToken: string | null = null;

try {
  localStorage.removeItem('lc.dash.accessToken');
  localStorage.removeItem('lc.dash.refreshToken');
} catch {
  /* almacenamiento no disponible */
}

export const tokenStore = {
  get access() {
    return accessToken;
  },
  save(token: string) {
    accessToken = token;
  },
  clear() {
    accessToken = null;
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

let refreshing: Promise<boolean> | null = null;

async function callRefresh(): Promise<boolean> {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...CLIENT_HEADERS },
    body: '{}',
  });
  if (!response.ok) return false;
  const data = await response.json();
  tokenStore.save(data.accessToken);
  return true;
}

/** Renueva con la cookie; Web Locks evita que dos pestanas roten a la vez */
export async function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const locks = (navigator as Navigator & { locks?: LockManager }).locks;
      return locks ? await locks.request('lc-dash-refresh', callRefresh) : await callRefresh();
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

interface Options extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
  retry?: boolean;
}

export async function request<T>(path: string, options: Options = {}): Promise<T> {
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
    if (await refreshSession()) return request<T>(path, { ...options, retry: false });
    tokenStore.clear();
    throw new ApiError('Tu sesion expiro', 401);
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const raw = payload?.message;
    throw new ApiError(
      Array.isArray(raw) ? raw.join('. ') : (raw ?? 'Error inesperado'),
      response.status,
    );
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Options) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
};
