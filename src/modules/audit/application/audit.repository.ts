import type { AuditResult } from '../../auth/application/audit-writer.js';

export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');

export interface AuditActor {
  email: string;
  fullName: string;
  id: string;
}

export interface AuditRecord {
  action: string;
  actor: AuditActor | null;
  createdAt: Date;
  id: string;
  ipAddress: string | null;
  metadata: unknown;
  resourceId: string | null;
  resourceType: string;
  result: AuditResult;
  userAgent: string | null;
}

export interface AuditFilters {
  action?: string;
  actor?: string;
  createdFrom?: Date;
  createdTo?: Date;
  result?: AuditResult;
}

export interface AuditPage extends AuditFilters {
  items: AuditRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListAuditInput extends AuditFilters {
  page: number;
  pageSize: number;
}

export interface AuditRepository {
  export(input: AuditFilters, limit: number): Promise<AuditRecord[]>;
  list(input: ListAuditInput): Promise<AuditPage>;
}
