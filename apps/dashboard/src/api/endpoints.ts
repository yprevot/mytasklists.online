import { api } from './client';
import type {
  ActivityRow,
  AdminListRow,
  AdminStats,
  AdminUser,
  Paginated,
  SeriesPoint,
} from '../types';

export const adminApi = {
  login: (email: string, password: string) =>
    api.post<{ accessToken: string; refreshToken: string; user: AdminUser }>(
      '/auth/login',
      { email, password },
      { auth: false },
    ),
  me: () => api.get<AdminUser>('/auth/me'),
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
