import type { Role } from '../../access-control/domain/access-control.js';

export const AUTH_USER_REPOSITORY = Symbol('AUTH_USER_REPOSITORY');

export interface AuthUser {
  email: string;
  fullName: string;
  id: string;
  lockedUntil: Date | null;
  mustChangePassword: boolean;
  passwordHash: string;
  role: Role;
  sessionVersion: number;
  status: 'ACTIVE' | 'DISABLED';
}

export interface AuthUserRepository {
  clearFailedLogins(userId: string): Promise<void>;
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(id: string): Promise<AuthUser | null>;
  recordFailedLogin(userId: string, occurredAt: Date): Promise<void>;
  updatePasswordAndInvalidateSessions(userId: string, passwordHash: string): Promise<void>;
}
