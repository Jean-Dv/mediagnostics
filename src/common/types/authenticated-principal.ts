import type { Role } from '../../modules/access-control/domain/access-control.js';

export interface AuthenticatedPrincipal {
  absoluteExpiresAt: string;
  email: string;
  fullName: string;
  id: string;
  mustChangePassword: boolean;
  role: Role;
  sessionVersion: number;
}
