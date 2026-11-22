import type { Role } from '../../access-control/domain/access-control.js';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export type ManagedUserStatus = 'ACTIVE' | 'DISABLED';

export interface ManagedUser {
  clinicalCode: string | null;
  createdAt: Date;
  email: string;
  fullName: string;
  id: string;
  mustChangePassword: boolean;
  role: Role;
  status: ManagedUserStatus;
  updatedAt: Date;
}

export interface CreateUserRecord {
  clinicalCode: string | null;
  email: string;
  fullName: string;
  passwordHash: string;
  role: Role;
}

export interface UserListQuery {
  page: number;
  role?: Role;
  search?: string;
  status?: ManagedUserStatus;
}

export interface UserPage {
  items: ManagedUser[];
  page: number;
  pageSize: number;
  total: number;
}

export type DisableUserResult =
  'DISABLED' | 'ALREADY_DISABLED' | 'LAST_ACTIVE_ADMINISTRATOR' | 'NOT_FOUND';

export type ActivateUserResult = 'ACTIVATED' | 'ALREADY_ACTIVE' | 'NOT_FOUND';
export type ResetPasswordResult = 'RESET' | 'DISABLED' | 'NOT_FOUND';

export interface UserRepository {
  create(input: CreateUserRecord): Promise<ManagedUser>;
  disable(userId: string): Promise<DisableUserResult>;
  findByEmail(email: string): Promise<ManagedUser | null>;
  findById(userId: string): Promise<ManagedUser | null>;
  list(query: UserListQuery): Promise<UserPage>;
  reactivate(userId: string, passwordHash: string): Promise<ActivateUserResult>;
  resetPassword(userId: string, passwordHash: string): Promise<ResetPasswordResult>;
  updateProfile(
    userId: string,
    input: { email: string; fullName: string },
  ): Promise<ManagedUser | null>;
}
