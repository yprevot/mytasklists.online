import type { UpdateProfileRequest } from '@lista/contracts';
import { api } from './client';
import type {
  AppNotification,
  AuthProviders,
  AuthResponse,
  Item,
  LoginResponse,
  ListDetail,
  ListSummary,
  User,
} from '../types';

export const authApi = {
  providers: () => api.get<AuthProviders>('/auth/providers', { auth: false }),
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }, { auth: false }),
  verifyMfa: (mfaToken: string, code: string) =>
    api.post<AuthResponse>('/auth/mfa/verify', { mfaToken, code }, { auth: false }),
  register: (payload: {
    fullName: string;
    email: string;
    whatsapp: string;
    password: string;
  }) => api.post<AuthResponse>('/auth/register', payload, { auth: false }),
  me: () => api.get<User>('/auth/me'),
  logout: () => api.post('/auth/logout', {}),
  verifyEmail: (token: string) =>
    api.post<{ ok: true; email: string }>('/auth/verify-email', { token }, { auth: false }),
  resendVerification: () => api.post<{ ok: true }>('/auth/verify-email/resend'),
  forgotPassword: (email: string) =>
    api.post<{ ok: true; message: string }>('/auth/forgot-password', { email }, { auth: false }),
  resetPassword: (token: string, newPassword: string) =>
    api.post<{ ok: true }>('/auth/reset-password', { token, newPassword }, { auth: false }),
};

export const usersApi = {
  updateProfile: (payload: UpdateProfileRequest) =>
    api.patch<User>('/users/me', payload),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch<AuthResponse & { ok: boolean }>('/users/me/password', {
      currentPassword: currentPassword || undefined,
      newPassword,
    }),
};

export const listsApi = {
  all: () => api.get<ListSummary[]>('/lists'),
  detail: (id: string) => api.get<ListDetail>(`/lists/${id}`),
  create: (payload: { name: string; description?: string; color?: string; icon?: string }) =>
    api.post<ListDetail>('/lists', payload),
  update: (id: string, payload: Record<string, unknown>) =>
    api.patch<ListDetail>(`/lists/${id}`, payload),
  remove: (id: string) => api.delete<{ ok: boolean }>(`/lists/${id}`),
  share: (id: string, email: string, role = 'editor') =>
    api.post<ListDetail>(`/lists/${id}/share`, { email, role }),
  setMyNotifications: (id: string, notifyOnChange: boolean) =>
    api.patch<ListDetail>(`/lists/${id}/notifications`, { notifyOnChange }),
  removeMember: (id: string, userId: string) =>
    api.delete<{ ok: boolean }>(`/lists/${id}/members/${userId}`),
};

export const itemsApi = {
  create: (
    listId: string,
    payload: {
      name: string;
      quantity?: number;
      unit?: string;
      note?: string;
      category?: string;
      isRecurring?: boolean;
      recurrenceDays?: number;
    },
  ) => api.post<Item>(`/lists/${listId}/items`, payload),
  update: (itemId: string, payload: Record<string, unknown>) =>
    api.patch<Item>(`/items/${itemId}`, payload),
  purchase: (itemId: string) => api.post<Item>(`/items/${itemId}/purchase`),
  restore: (itemId: string) => api.post<Item>(`/items/${itemId}/restore`),
  close: (itemId: string) => api.delete<{ id: string }>(`/items/${itemId}/close`),
  remove: (itemId: string) => api.delete<{ id: string }>(`/items/${itemId}`),
  clearPurchased: (listId: string) =>
    api.delete<{ cleared: number }>(`/lists/${listId}/items/purchased`),
  advanceClock: (itemId: string, days: number) =>
    api.post<{ reactivated: number; overdue: number }>(`/recurrence/items/${itemId}/advance`, {
      days,
    }),
};

export const notificationsApi = {
  list: () => api.get<AppNotification[]>('/notifications'),
  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => api.patch<{ ok: boolean }>(`/notifications/${id}/read`),
  markAllRead: () => api.patch<{ ok: boolean }>('/notifications/read-all'),
};
