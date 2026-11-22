import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  StreamableFile,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { Permission } from '../../access-control/domain/access-control.js';
import { RequirePermissions } from '../../access-control/presentation/access-control.decorators.js';
import type { AuditFilters, AuditRecord } from '../application/audit.repository.js';
import { AuditService } from '../application/audit.service.js';
import { AuditPageDto, AuditRecordDto } from './dto/audit-response.dto.js';
import { ListAuditQueryDto } from './dto/list-audit-query.dto.js';

@ApiTags('audit')
@ApiCookieAuth('mediagnostics.sid')
@Controller({ path: 'audit', version: '1' })
export class AuditController {
  public constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions(Permission.AuditRead)
  @ApiOkResponse({ type: AuditPageDto })
  public async list(@Query() query: ListAuditQueryDto): Promise<AuditPageDto> {
    const page = await this.auditService.list({
      ...this.toFilters(query),
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      items: page.items.map((event) => this.toResponse(event)),
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.totalPages,
    };
  }

  @Get('export')
  @RequirePermissions(Permission.AuditExport)
  @ApiProduces('text/csv')
  public async export(
    @Query() query: ListAuditQueryDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const principal = request.user;
    if (principal === undefined) throw new UnauthorizedException('Authentication is required.');
    const result = await this.auditService.export(this.toFilters(query), {
      actorId: principal.id,
      ipAddress: request.ip ?? null,
      userAgent: request.get('user-agent')?.slice(0, 512) ?? null,
    });
    response.set({
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Content-Length': result.body.length.toString(),
      'Content-Type': 'text/csv; charset=utf-8',
    });
    return new StreamableFile(result.body);
  }

  private toFilters(query: ListAuditQueryDto): AuditFilters {
    return {
      ...(query.action === undefined || query.action.length === 0 ? {} : { action: query.action }),
      ...(query.actor === undefined || query.actor.length === 0 ? {} : { actor: query.actor }),
      ...(query.from === undefined
        ? {}
        : { createdFrom: new Date(`${query.from}T00:00:00.000-05:00`) }),
      ...(query.result === undefined ? {} : { result: query.result }),
      ...(query.to === undefined ? {} : { createdTo: new Date(`${query.to}T23:59:59.999-05:00`) }),
    };
  }

  private toResponse(event: AuditRecord): AuditRecordDto {
    return {
      action: event.action,
      actor: event.actor,
      createdAt: event.createdAt.toISOString(),
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
