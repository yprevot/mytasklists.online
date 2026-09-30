import { api } from './client';
import type { AuthResponse, Item, ListDetail, ListSummary, User } from '../types';

export const authApi = {
  providers: () =>
    api.post<{ local: boolean; google: boolean; apple: boolean }>('/auth/providers', undefined, false)
      .catch(() => ({ local: true, google: false, apple: false })),
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }, false),
  register: (payload: { fullName: string; email: string; whatsapp: string; password: string }) =>
    api.post<AuthResponse>('/auth/register', payload, false),
  google: (token: string, whatsapp?: string) =>
    api.post<AuthResponse>('/auth/google/token', { token, whatsapp }, false),
  apple: (token: string, fullName?: string, whatsapp?: string) =>
    api.post<AuthResponse>('/auth/apple/token', { token, fullName, whatsapp }, false),
  me: () => api.get<User>('/auth/me'),
  logout: (refreshToken?: string | null) => api.post('/auth/logout', { refreshToken }),
};

export const listsApi = {
  all: () => api.get<ListSummary[]>('/lists'),
  detail: (id: string) => api.get<ListDetail>(`/lists/${id}`),
  create: (name: string) => api.post<ListDetail>('/lists', { name }),
  remove: (id: string) => api.delete<{ ok: boolean }>(`/lists/${id}`),
  share: (id: string, email: string) => api.post<ListDetail>(`/lists/${id}/share`, { email }),
  setMyNotifications: (id: string, notifyOnChange: boolean) =>
    api.patch<ListDetail>(`/lists/${id}/notifications`, { notifyOnChange }),
};

export const itemsApi = {
  create: (
    listId: string,
    payload: { name: string; quantity?: number; unit?: string; isRecurring?: boolean; recurrenceDays?: number },
  ) => api.post<Item>(`/lists/${listId}/items`, payload),
  purchase: (itemId: string) => api.post<Item>(`/items/${itemId}/purchase`),
  restore: (itemId: string) => api.post<Item>(`/items/${itemId}/restore`),
  close: (itemId: string) => api.delete<{ id: string }>(`/items/${itemId}/close`),
  remove: (itemId: string) => api.delete<{ id: string }>(`/items/${itemId}`),
  advanceClock: (itemId: string, days: number) =>
    api.post<{ reactivated: number; overdue: number }>(`/recurrence/items/${itemId}/advance`, { days }),
};

export const devicesApi = {
  register: (token: string, platform: 'ios' | 'android' | 'web', deviceName?: string) =>
    api.post<{ id: string }>('/notifications/devices', { token, platform, deviceName }),
  unregister: (token: string) => api.delete<{ ok: boolean }>(`/notifications/devices/${token}`),
};
