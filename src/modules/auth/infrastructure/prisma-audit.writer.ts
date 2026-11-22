import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/infrastructure/database/prisma.service.js';
import type { AuditEntry, AuditWriter } from '../application/audit-writer.js';

@Injectable()
export class PrismaAuditWriter implements AuditWriter {
  public constructor(private readonly prisma: PrismaService) {}

  public async write(entry: AuditEntry): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        action: entry.action,
        actorId: entry.actorId,
        ipAddress: entry.ipAddress,
        metadata: entry.metadata,
        resourceId: entry.resourceId,
        resourceType: entry.resourceType,
        result: entry.result,
        userAgent: entry.userAgent,
      },
    });
  }
}
