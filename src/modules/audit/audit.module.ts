import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AUDIT_REPOSITORY } from './application/audit.repository.js';
import { AuditService } from './application/audit.service.js';
import { PrismaAuditRepository } from './infrastructure/prisma-audit.repository.js';
import { AuditController } from './presentation/audit.controller.js';

@Module({
  controllers: [AuditController],
  imports: [AuthModule],
  providers: [
    AuditService,
    PrismaAuditRepository,
    { provide: AUDIT_REPOSITORY, useExisting: PrismaAuditRepository },
  ],
})
export class AuditModule {}
