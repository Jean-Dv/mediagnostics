export const AUDIT_WRITER = Symbol('AUDIT_WRITER');

export type AuditResult = 'SUCCESS' | 'FAILURE';

export interface AuditEntry {
  action: string;
  actorId: string | null;
  ipAddress: string | null;
  metadata: Record<string, boolean | number | string | null>;
  resourceId: string | null;
  resourceType: string;
  result: AuditResult;
  userAgent: string | null;
}

export interface AuditWriter {
  write(entry: AuditEntry): Promise<void>;
}
