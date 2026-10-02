import type { DeleteAccountRequest, UpdateProfileRequest } from '@lista/contracts';
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
  requestRegistration: (email: string) => api.post<{ok:true;cooldownSeconds:number}>('/auth/registration/request', {email}, {auth:false}),
  validateRegistration: (token: string) => api.post<{email:string}>('/auth/registration/validate', {token}, {auth:false}),
  completeRegistration: (payload: import('@lista/contracts').CompleteRegistrationRequest) => api.post<AuthResponse>('/auth/registration/complete', payload, {auth:false}),
  register: (payload: import('@lista/contracts').CompleteRegistrationRequest) => api.post<AuthResponse>('/auth/registration/complete', payload, {auth:false}),
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
  deleteAccount: (payload: DeleteAccountRequest) =>
    api.delete<{ ok: true; appleRevoked: boolean }>('/users/me', { body: payload }),
};

export interface PendingInvitation { id: string; email: string; role: string; expiresAt: string; lastSentAt: string | null; }
export const listsApi = {
  invitations: (id: string) => api.get<PendingInvitation[]>(`/lists/${id}/invitations`),
  revokeInvitation: (id: string, invitationId: string) => api.delete<{ok:true}>(`/lists/${id}/invitations/${invitationId}`),
  all: () => api.get<ListSummary[]>('/lists'),
  detail: (id: string) => api.get<ListDetail>(`/lists/${id}`),
  create: (payload: { name: string; description?: string; color?: string; icon?: string }) =>
    api.post<ListDetail>('/lists', payload),
  update: (id: string, payload: Record<string, unknown>) =>
    api.patch<ListDetail>(`/lists/${id}`, payload),
  remove: (id: string) => api.delete<{ ok: boolean }>(`/lists/${id}`),
  share: (id: string, email: string, role = 'editor') =>
    api.post<ListDetail & { invitationSent?: boolean; invitationEmail?: string }>(`/lists/${id}/share`, { email, role }),
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
  uploadImage: (itemId: string, image: FormData) => api.post<Item>(`/items/${itemId}/image`, image),
  removeImage: (itemId: string) => api.delete<Item>(`/items/${itemId}/image`),
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

export const billingApi = {
 plans:()=>api.get<import('@lista/contracts').BillingPlans>('/billing/plans',{auth:false}),
 me:()=>api.get<import('@lista/contracts').BillingState>('/billing/me'),
 promotion:(code:string)=>api.post<import('@lista/contracts').PromotionQuote>('/billing/promotion',{code}),
 checkout:(payload:import('@lista/contracts').CheckoutRequest)=>api.post<{url:string}>('/billing/checkout',payload),
 portal:()=>api.post<{url:string}>('/billing/portal',{}),
};
