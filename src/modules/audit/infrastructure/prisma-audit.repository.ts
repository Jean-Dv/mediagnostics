import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/infrastructure/database/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type {
  AuditFilters,
  AuditPage,
  AuditRecord,
  AuditRepository,
  ListAuditInput,
} from '../application/audit.repository.js';

const auditInclude = {
  actor: { select: { email: true, fullName: true, id: true } },
} satisfies Prisma.AuditEventInclude;

type AuditWithActor = Prisma.AuditEventGetPayload<{ include: typeof auditInclude }>;

@Injectable()
export class PrismaAuditRepository implements AuditRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async export(input: AuditFilters, limit: number): Promise<AuditRecord[]> {
    const events = await this.prisma.auditEvent.findMany({
      include: auditInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      where: this.createWhere(input),
    });
    return events.map((event) => this.toAuditRecord(event));
  }

  public async list(input: ListAuditInput): Promise<AuditPage> {
    const where = this.createWhere(input);
    const [events, total] = await this.prisma.$transaction([
      this.prisma.auditEvent.findMany({
        include: auditInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where,
      }),
      this.prisma.auditEvent.count({ where }),
    ]);
    return {
      items: events.map((event) => this.toAuditRecord(event)),
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.ceil(total / input.pageSize),
    };
  }

  private createWhere(input: AuditFilters): Prisma.AuditEventWhereInput {
    return {
      ...(input.action === undefined
        ? {}
        : { action: { contains: input.action, mode: 'insensitive' } }),
      ...(input.actor === undefined
        ? {}
        : {
            actor: {
              is: {
                OR: [
                  { email: { contains: input.actor, mode: 'insensitive' } },
                  { fullName: { contains: input.actor, mode: 'insensitive' } },
                ],
              },
            },
          }),
      ...(input.createdFrom === undefined && input.createdTo === undefined
        ? {}
        : {
            createdAt: {
              ...(input.createdFrom === undefined ? {} : { gte: input.createdFrom }),
              ...(input.createdTo === undefined ? {} : { lte: input.createdTo }),
            },
          }),
      ...(input.result === undefined ? {} : { result: input.result }),
    };
  }

  private toAuditRecord(event: AuditWithActor): AuditRecord {
    return {
      action: event.action,
      actor: event.actor,
      createdAt: event.createdAt,
      id: event.id,
      ipAddress: event.ipAddress,
      metadata: event.metadata,
      resourceId: event.resourceId,
      resourceType: event.resourceType,
      result: event.result,
      userAgent: event.userAgent,
    };
  }
}
