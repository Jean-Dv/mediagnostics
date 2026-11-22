import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import type { RequestContext } from '../../../common/types/request-context.js';
import { AUDIT_WRITER, type AuditWriter } from '../../auth/application/audit-writer.js';
import {
  AUDIT_REPOSITORY,
  type AuditFilters,
  type AuditPage,
  type AuditRecord,
  type AuditRepository,
  type ListAuditInput,
} from './audit.repository.js';

const maximumExportRows = 10_000;

export interface AuditExportContext extends RequestContext {
  actorId: string;
}

export interface AuditCsvExport {
  body: Buffer;
  filename: string;
}

@Injectable()
export class AuditService {
  public constructor(
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    @Inject(AUDIT_WRITER)
    private readonly auditWriter: AuditWriter,
  ) {}

  public list(input: ListAuditInput): Promise<AuditPage> {
    this.validateDateRange(input);
    return this.auditRepository.list(input);
  }

  public async export(input: AuditFilters, context: AuditExportContext): Promise<AuditCsvExport> {
    this.validateDateRange(input);
    const events = await this.auditRepository.export(input, maximumExportRows);
    const csv = this.createCsv(events);
    await this.auditWriter.write({
      action: 'audit.export',
      actorId: context.actorId,
      ipAddress: context.ipAddress,
      metadata: { exportedRows: events.length },
      resourceId: null,
      resourceType: 'audit',
      result: 'SUCCESS',
      userAgent: context.userAgent,
    });
    return {
      body: Buffer.from(`\uFEFF${csv}`, 'utf8'),
      filename: `mediagnostics-audit-${new Date().toISOString().slice(0, 10)}.csv`,
    };
  }

  private createCsv(events: AuditRecord[]): string {
    const header = [
      'createdAt',
      'result',
      'action',
      'actorId',
      'actorName',
      'actorEmail',
      'resourceType',
      'resourceId',
      'ipAddress',
      'userAgent',
      'metadata',
    ];
    const rows = events.map((event) => [
      event.createdAt.toISOString(),
      event.result,
      event.action,
      event.actor?.id ?? '',
      event.actor?.fullName ?? 'System',
      event.actor?.email ?? '',
      event.resourceType,
      event.resourceId ?? '',
      event.ipAddress ?? '',
      event.userAgent ?? '',
      event.metadata === null ? '' : JSON.stringify(event.metadata),
    ]);
    return [header, ...rows]
      .map((row) => row.map((value) => this.escapeCsvCell(value)).join(','))
      .join('\r\n');
  }

  private escapeCsvCell(value: string): string {
    const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${safeValue.replaceAll('"', '""')}"`;
  }

  private validateDateRange(input: AuditFilters): void {
    if (
      input.createdFrom !== undefined &&
      input.createdTo !== undefined &&
      input.createdFrom > input.createdTo
    ) {
      throw new BadRequestException({
        code: 'INVALID_AUDIT_DATE_RANGE',
        message: 'The start date must not be later than the end date.',
      });
    }
  }
}
