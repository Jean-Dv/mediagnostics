import { Module } from '@nestjs/common';

import { AuthService } from './application/auth.service.js';
import { AUTH_USER_REPOSITORY } from './application/auth-user.repository.js';
import { AUDIT_WRITER } from './application/audit-writer.js';
import { PASSWORD_HASHER } from './domain/password-hasher.js';
import { NodePasswordHasher } from './infrastructure/node-password-hasher.js';
import { PrismaAuditWriter } from './infrastructure/prisma-audit.writer.js';
import { PrismaAuthUserRepository } from './infrastructure/prisma-auth-user.repository.js';
import { AuthController } from './presentation/auth.controller.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    NodePasswordHasher,
    PrismaAuditWriter,
    PrismaAuthUserRepository,
    { provide: PASSWORD_HASHER, useExisting: NodePasswordHasher },
    { provide: AUTH_USER_REPOSITORY, useExisting: PrismaAuthUserRepository },
    { provide: AUDIT_WRITER, useExisting: PrismaAuditWriter },
  ],
  exports: [AUTH_USER_REPOSITORY, AUDIT_WRITER, PASSWORD_HASHER],
})
export class AuthModule {}
