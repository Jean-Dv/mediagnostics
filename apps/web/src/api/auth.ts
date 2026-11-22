import { ApiError, apiRequest } from './client';

export type Role = 'ADMIN' | 'OPERATOR' | 'PATIENT';

export interface Session {
  email: string;
  fullName: string;
  id: string;
  passwordChangeRequired: boolean;
  role: Role;
}

export async function getSession(): Promise<Session | null> {
  try {
    return await apiRequest<Session>('/api/v1/auth/me');
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export function login(input: { email: string; password: string }): Promise<Session> {
  return apiRequest<Session>('/api/v1/auth/login', { body: input, method: 'POST' });
}

export function logout(): Promise<undefined> {
  return apiRequest<undefined>('/api/v1/auth/logout', { method: 'POST' });
}

export function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<undefined> {
  return apiRequest<undefined>('/api/v1/auth/change-password', { body: input, method: 'POST' });
}
