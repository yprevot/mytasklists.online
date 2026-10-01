import { waitForEmail, tokenFromEmail } from './mailpit';
import type { APIRequestContext } from '@playwright/test';

export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
export const API_URL = process.env.E2E_API_URL ?? `${BASE_URL}/api`;

/** Cuentas cargadas por el seed del backend */
export const SEED = {
  admin: { email: 'admin@mytasklists.online', password: 'Admin12345' },
  ana: { email: 'ana@example.com', password: 'Demo12345' },
  carlos: { email: 'carlos@example.com', password: 'Demo12345' },
};

export const DEFAULT_PASSWORD = 'Prueba12345';

let counter = 0;
export const uniqueEmail = (prefix = 'e2e'): string => {
  counter += 1;
  return `${prefix}.${Date.now().toString(36)}${counter}@example.com`;
};

export const uniqueWhatsapp = (): string =>
  `+52155${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;

export interface TestUser {
  id: string;
  fullName: string;
  email: string;
  password: string;
  whatsapp: string;
  accessToken: string;
  refreshToken: string;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Crea una cuenta nueva directamente contra la API */
export async function registerUser(
  request: APIRequestContext,
  overrides: Partial<{ fullName: string; email: string; whatsapp: string; password: string }> = {},
): Promise<TestUser> {
  const payload = {
    fullName: overrides.fullName ?? 'Persona De Prueba',
    email: overrides.email ?? uniqueEmail(),
    whatsapp: overrides.whatsapp ?? uniqueWhatsapp(),
    password: overrides.password ?? DEFAULT_PASSWORD,
  };

  const initiate = await request.post(`${API_URL}/auth/registration/request`, { data: {email: payload.email} });
  if (!initiate.ok()) throw new Error(`No se pudo solicitar registro: ${initiate.status()}`);
  const mail = await waitForEmail(request, payload.email, 'Completa tu registro');
  const token = tokenFromEmail(mail, '/app/register/complete');
  const response = await request.post(`${API_URL}/auth/registration/complete`, { data: {token,fullName:payload.fullName,whatsapp:payload.whatsapp,password:payload.password,passwordConfirmation:payload.password} });
  if (!response.ok()) {
    throw new Error(`No se pudo registrar a ${payload.email}: ${await response.text()}`);
  }
  const body = await response.json();

  return {
    id: body.user.id,
    fullName: payload.fullName,
    email: payload.email,
    password: payload.password,
    whatsapp: payload.whatsapp,
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
  };
}

export async function loginUser(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string; user: any }> {
  const response = await request.post(`${API_URL}/auth/login`, { data: { email, password } });
  if (!response.ok()) throw new Error(`Login fallido para ${email}: ${await response.text()}`);
  return response.json();
}

export async function createList(
  request: APIRequestContext,
  token: string,
  name: string,
): Promise<any> {
  const response = await request.post(`${API_URL}/lists`, {
    headers: auth(token),
    data: { name },
  });
  if (!response.ok()) throw new Error(`No se pudo crear la lista: ${await response.text()}`);
  return response.json();
}

export async function createItem(
  request: APIRequestContext,
  token: string,
  listId: string,
  data: Record<string, unknown>,
): Promise<any> {
  const response = await request.post(`${API_URL}/lists/${listId}/items`, {
    headers: auth(token),
    data,
  });
  if (!response.ok()) throw new Error(`No se pudo crear el producto: ${await response.text()}`);
  return response.json();
}

export async function shareList(
  request: APIRequestContext,
  token: string,
  listId: string,
  email: string,
): Promise<any> {
  const response = await request.post(`${API_URL}/lists/${listId}/share`, {
    headers: auth(token),
    data: { email },
  });
  if (!response.ok()) throw new Error(`No se pudo compartir la lista: ${await response.text()}`);
  return response.json();
}

export async function getList(
  request: APIRequestContext,
  token: string,
  listId: string,
): Promise<any> {
  const response = await request.get(`${API_URL}/lists/${listId}`, { headers: auth(token) });
  if (!response.ok()) throw new Error(`No se pudo leer la lista: ${await response.text()}`);
  return response.json();
}

/** Adelanta el reloj de un producto N días y dispara el motor de recurrencia */
export async function advanceClock(
  request: APIRequestContext,
  token: string,
  itemId: string,
  days: number,
): Promise<{ reactivated: number; overdue: number }> {
  const response = await request.post(`${API_URL}/recurrence/items/${itemId}/advance`, {
    headers: auth(token),
    data: { days },
  });
  if (!response.ok()) throw new Error(`No se pudo adelantar el reloj: ${await response.text()}`);
  return response.json();
}

export async function deleteList(
  request: APIRequestContext,
  token: string,
  listId: string,
): Promise<void> {
  await request.delete(`${API_URL}/lists/${listId}`, { headers: auth(token) });
}
