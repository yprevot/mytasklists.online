import type { UpdateProfileRequest } from '@lista/contracts';
import { api } from './client';
import type {
  ActivityRow,
  AdminListRow,
  AdminStats,
  AdminUser,
  Paginated,
  SeriesPoint,
} from '../types';

export interface AdminSession {
  accessToken: string;
  user: AdminUser;
}

export type AdminLoginResponse = AdminSession | { mfaRequired: true; mfaToken: string };

export const adminApi = {
  login: (email: string, password: string) =>
    api.post<AdminLoginResponse>('/auth/login', { email, password }, { auth: false }),
  verifyMfa: (mfaToken: string, code: string) =>
    api.post<AdminSession>('/auth/mfa/verify', { mfaToken, code }, { auth: false }),
  logout: () => api.post<{ ok: boolean }>('/auth/logout', {}),
  me: () => api.get<AdminUser>('/auth/me'),
  updateProfile: (payload: UpdateProfileRequest) => api.patch<AdminUser>('/users/me', payload),
  mfaSetup: () => api.post<{ secret: string; otpauthUrl: string }>('/auth/mfa/setup'),
  mfaEnable: (code: string) =>
    api.post<{ enabled: true; recoveryCodes: string[] }>('/auth/mfa/enable', { code }),
  mfaDisable: (code: string) => api.post<{ enabled: false }>('/auth/mfa/disable', { code }),
  resetUserMfa: (id: string) => api.patch<AdminUser>(`/admin/users/${id}`, { resetMfa: true }),
  stats: () => api.get<AdminStats>('/admin/stats'),
  timeseries: (days = 14) => api.get<SeriesPoint[]>(`/admin/timeseries?days=${days}`),
  activity: (limit = 40) => api.get<ActivityRow[]>(`/admin/activity?limit=${limit}`),
  users: (page = 1, search = '') =>
    api.get<Paginated<AdminUser>>(
      `/admin/users?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`,
    ),
  setUserActive: (id: string, isActive: boolean) =>
    api.patch<AdminUser>(`/admin/users/${id}`, { isActive }),
  lists: (page = 1, search = '') =>
    api.get<Paginated<AdminListRow>>(
      `/admin/lists?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`,
    ),
  runRecurrence: () =>
    api.post<{ reactivated: number; overdue: number; ranAt: string }>('/recurrence/run'),
};
