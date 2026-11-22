import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

import { ProblemDetailsFilter } from './common/http/problem-details.filter.js';
import { InfrastructureModule } from './common/infrastructure/infrastructure.module.js';
import { AuthenticationGuard } from './modules/access-control/presentation/authentication.guard.js';
import { PermissionsGuard } from './modules/access-control/presentation/permissions.guard.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    InfrastructureModule,
    AuthModule,
    AuditModule,
    DocumentsModule,
    HealthModule,
    NotificationsModule,
    UsersModule,
  ],
  providers: [
    AuthenticationGuard,
    PermissionsGuard,
    { provide: APP_GUARD, useExisting: AuthenticationGuard },
    { provide: APP_GUARD, useExisting: PermissionsGuard },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class AppModule {}
