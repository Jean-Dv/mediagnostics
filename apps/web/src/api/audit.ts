import { apiBlob, apiRequest } from './client';

export type AuditResult = 'FAILURE' | 'SUCCESS';

export interface AuditRecord {
  action: string;
  actor: { email: string; fullName: string; id: string } | null;
  createdAt: string;
  id: string;
  ipAddress: string | null;
  metadata: unknown;
  resourceId: string | null;
  resourceType: string;
  result: AuditResult;
  userAgent: string | null;
}

export interface AuditPage {
  items: AuditRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AuditFilters {
  action?: string;
  actor?: string;
  from?: string;
  result?: AuditResult;
  to?: string;
}

function createParameters(filters: AuditFilters, page?: number): URLSearchParams {
  const parameters = new URLSearchParams();
  if (page !== undefined) {
    parameters.set('page', page.toString());
    parameters.set('pageSize', '20');
  }
  if (filters.action !== undefined && filters.action !== '') {
    parameters.set('action', filters.action);
  }
  if (filters.actor !== undefined && filters.actor !== '') {
    parameters.set('actor', filters.actor);
  }
  if (filters.from !== undefined && filters.from !== '') parameters.set('from', filters.from);
  if (filters.result !== undefined) parameters.set('result', filters.result);
  if (filters.to !== undefined && filters.to !== '') parameters.set('to', filters.to);
  return parameters;
}

export function listAuditEvents(filters: AuditFilters, page: number): Promise<AuditPage> {
  return apiRequest<AuditPage>(`/api/v1/audit?${createParameters(filters, page).toString()}`);
}

export function exportAuditEvents(filters: AuditFilters): Promise<Blob> {
  return apiBlob(`/api/v1/audit/export?${createParameters(filters).toString()}`, 'text/csv');
}
