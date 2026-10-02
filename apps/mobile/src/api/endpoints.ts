import type { DeleteAccountRequest, UpdateProfileRequest } from '@lista/contracts';
import { api } from './client';
import type {
  AppCompatibility,
  AuthResponse,
  Item,
  ListDetail,
  ListSummary,
  LoginResponse,
  User,
} from '../types';

/** Si esta versión ya no es compatible la API responde 426 y client.ts avisa a UpdateGate */
export const compatApi = {
  check: () => api.get<AppCompatibility>('/app/compatibility'),
};

export const usersApi = {
  updateProfile: (payload: UpdateProfileRequest) => api.patch<User>('/users/me', payload),
  /** Perfil propio con `hasPassword`, que /auth/me no trae */
  me: () => api.get<User>('/users/me'),
  deleteAccount: (payload: DeleteAccountRequest) =>
    api.delete<{ ok: true; appleRevoked: boolean }>('/users/me', payload),
};

export const authApi = {
  requestRegistration: (email: string) => api.post<{ok:true;cooldownSeconds:number}>('/auth/registration/request', {email}, false),
  providers: () =>
    api
      .get<{ local: boolean; google: boolean; apple: boolean }>('/auth/providers')
      .catch(() => ({ local: true, google: false, apple: false })),
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }, false),
  verifyMfa: (mfaToken: string, code: string) =>
    api.post<AuthResponse>('/auth/mfa/verify', { mfaToken, code }, false),
  forgotPassword: (email: string) =>
    api.post<{ ok: true; message: string }>('/auth/forgot-password', { email }, false),
  resendVerification: () => api.post<{ ok: true }>('/auth/verify-email/resend'),
  google: (token: string, whatsapp?: string) =>
    api.post<LoginResponse>('/auth/google/token', { token, whatsapp }, false),
  apple: (token: string, fullName?: string, whatsapp?: string) =>
    api.post<LoginResponse>('/auth/apple/token', { token, fullName, whatsapp }, false),
  me: () => api.get<User>('/auth/me'),
  logout: (refreshToken?: string | null) => api.post('/auth/logout', { refreshToken }),
};

export const listsApi = {
  all: () => api.get<ListSummary[]>('/lists'),
  detail: (id: string) => api.get<ListDetail>(`/lists/${id}`),
  create: (name: string) => api.post<ListDetail>('/lists', { name }),
  remove: (id: string) => api.delete<{ ok: boolean }>(`/lists/${id}`),
  share: (id: string, email: string) => api.post<ListDetail & { invitationSent?: boolean; invitationEmail?: string }>(`/lists/${id}/share`, { email }),
  setMyNotifications: (id: string, notifyOnChange: boolean) =>
    api.patch<ListDetail>(`/lists/${id}/notifications`, { notifyOnChange }),
};

export const itemsApi = {
  create: (
    listId: string,
    payload: { name: string; quantity?: number; unit?: string; isRecurring?: boolean; recurrenceDays?: number },
  ) => api.post<Item>(`/lists/${listId}/items`, payload),
  update: (itemId: string, payload: Record<string, unknown>) => api.patch<Item>(`/items/${itemId}`, payload),
  uploadImage: (itemId: string, image: FormData) => api.post<Item>(`/items/${itemId}/image`, image),
  removeImage: (itemId: string) => api.delete<Item>(`/items/${itemId}/image`),
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

export const billingApi = {
 plans:()=>api.get<import('@lista/contracts').BillingPlans>('/billing/plans'),
 me:()=>api.get<import('@lista/contracts').BillingState>('/billing/me'),
 checkout:()=>api.post<{url:string}>('/billing/checkout',{}),
 portal:()=>api.post<{url:string}>('/billing/portal',{}),
 verify:(payload:import('@lista/contracts').StorePurchaseRequest)=>api.post<{ok:true}>('/billing/store/verify',payload),
 nativePromotion:(code:string)=>api.post<{offerId:string}>('/billing/native-promotion',{code}),
 promotion:(code:string)=>api.post<import('@lista/contracts').PromotionQuote>('/billing/promotion',{code}),
 discountedCheckout:(code:string,expectedTotal:number)=>api.post<{url:string}>('/billing/checkout',{code,expectedTotal}),
};
