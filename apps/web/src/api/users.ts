import type { Role } from './auth';
import { apiRequest } from './client';

export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface UserSummary {
  clinicalCode: string | null;
  createdAt: string;
  email: string;
  fullName: string;
  id: string;
  passwordChangeRequired: boolean;
  role: Role;
  status: UserStatus;
  updatedAt: string;
}

export interface UserPage {
  items: UserSummary[];
  page: number;
  pageSize: number;
  total: number;
}

export interface TemporaryCredential {
  temporaryPassword: string;
  user: UserSummary;
}

export interface UserFilters {
  page: number;
  role?: Role;
  search?: string;
  status?: UserStatus;
}

export function listUsers(filters: UserFilters): Promise<UserPage> {
  const parameters = new URLSearchParams({ page: filters.page.toString() });
  if (filters.role !== undefined) parameters.set('role', filters.role);
  if (filters.search !== undefined && filters.search.length > 0) {
    parameters.set('search', filters.search);
  }
  if (filters.status !== undefined) parameters.set('status', filters.status);

  return apiRequest<UserPage>(`/api/v1/users?${parameters.toString()}`);
}

export function createUser(input: {
  email: string;
  fullName: string;
  role: Role;
}): Promise<TemporaryCredential> {
  return apiRequest<TemporaryCredential>('/api/v1/users', { body: input, method: 'POST' });
}

export function updateUser(
  userId: string,
  input: { email: string; fullName: string },
): Promise<UserSummary> {
  return apiRequest<UserSummary>(`/api/v1/users/${userId}`, {
    body: input,
    method: 'PATCH',
  });
}

export function disableUser(userId: string): Promise<undefined> {
  return apiRequest<undefined>(`/api/v1/users/${userId}/disable`, { method: 'POST' });
}

export function reactivateUser(userId: string): Promise<TemporaryCredential> {
  return apiRequest<TemporaryCredential>(`/api/v1/users/${userId}/reactivate`, {
    method: 'POST',
  });
}

export function resetUserPassword(userId: string): Promise<TemporaryCredential> {
  return apiRequest<TemporaryCredential>(`/api/v1/users/${userId}/reset-password`, {
    method: 'POST',
  });
}
