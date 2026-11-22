import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditWriter } from '../../auth/application/audit-writer.js';
import type { AuditRecord, AuditRepository } from './audit.repository.js';
import { AuditService } from './audit.service.js';

const event: AuditRecord = {
  action: 'document.publish',
  actor: {
    email: 'admin@example.test',
    fullName: '=IMPORTXML("https://example.test")',
    id: '6c311ec6-97fd-45c1-8c30-63e76430e8c4',
  },
  createdAt: new Date('2026-11-22T14:30:00.000Z'),
  id: '10ab85fb-fd34-4169-b53e-920590beef7b',
  ipAddress: '127.0.0.1',
  metadata: { patientId: 'patient-id' },
  resourceId: 'document-id',
  resourceType: 'document',
  result: 'SUCCESS',
  userAgent: 'vitest',
};

describe('AuditService', () => {
  let auditExport: ReturnType<typeof vi.fn<AuditRepository['export']>>;
  let auditList: ReturnType<typeof vi.fn<AuditRepository['list']>>;
  let auditWrite: ReturnType<typeof vi.fn<AuditWriter['write']>>;
  let service: AuditService;

  beforeEach(() => {
    auditExport = vi.fn<AuditRepository['export']>().mockResolvedValue([event]);
    auditList = vi.fn<AuditRepository['list']>().mockResolvedValue({
      items: [event],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    auditWrite = vi.fn<AuditWriter['write']>().mockResolvedValue(undefined);
    service = new AuditService({ export: auditExport, list: auditList }, { write: auditWrite });
  });

  it('lists audit events with repository filters', async () => {
    const input = { action: 'document', page: 1, pageSize: 20, result: 'SUCCESS' as const };

    await expect(service.list(input)).resolves.toMatchObject({ total: 1 });
    expect(auditList).toHaveBeenCalledWith(input);
  });

  it('rejects an inverted date range', () => {
    const input = {
      createdFrom: new Date('2026-11-22T00:00:00.000Z'),
      createdTo: new Date('2026-11-21T23:59:59.999Z'),
      page: 1,
      pageSize: 20,
    };

    expect(() => service.list(input)).toThrow(BadRequestException);
    expect(auditList).not.toHaveBeenCalled();
  });

  it('exports a safe UTF-8 CSV and audits the export', async () => {
    const result = await service.export(
      { actor: 'admin' },
      {
        actorId: event.actor?.id ?? '',
        ipAddress: '127.0.0.1',
        userAgent: 'vitest',
      },
    );
    const csv = result.body.toString('utf8');

    expect(auditExport).toHaveBeenCalledWith({ actor: 'admin' }, 10_000);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain("'=IMPORTXML(");
    expect(csv).toContain('""https://example.test""');
    expect(result.filename).toMatch(/^mediagnostics-audit-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'audit.export',
        metadata: { exportedRows: 1 },
        result: 'SUCCESS',
      }),
    );
  });
});
