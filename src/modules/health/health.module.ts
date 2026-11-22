import { Module } from '@nestjs/common';

import { DocumentsModule } from '../documents/documents.module.js';
import { SystemHealthService } from './application/system-health.service.js';
import { HealthController } from './presentation/health.controller.js';

@Module({
  controllers: [HealthController],
  imports: [DocumentsModule],
  providers: [SystemHealthService],
})
export class HealthModule {}
