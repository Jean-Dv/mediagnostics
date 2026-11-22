import { Module } from '@nestjs/common';

import { loadEnvironment } from './common/config/environment.js';
import { InfrastructureModule } from './common/infrastructure/infrastructure.module.js';
import { DOCUMENT_STORAGE } from './modules/documents/application/document-storage.js';
import { S3DocumentStorage } from './modules/documents/infrastructure/s3-document.storage.js';
import { DocumentProcessingService } from './modules/processing/application/document-processing.service.js';
import {
  PDF_ENCRYPTION_KEY,
  PDF_PASSWORD_VAULT,
} from './modules/processing/application/pdf-password-vault.js';
import { PDF_PROCESSOR } from './modules/processing/application/pdf-processor.js';
import { PROCESSING_REPOSITORY } from './modules/processing/application/processing.repository.js';
import { BullMqProcessingWorker } from './modules/processing/infrastructure/bullmq-processing.worker.js';
import { LinuxPdfProcessor } from './modules/processing/infrastructure/linux-pdf.processor.js';
import { NodePdfPasswordVault } from './modules/processing/infrastructure/node-pdf-password.vault.js';
import { PrismaProcessingRepository } from './modules/processing/infrastructure/prisma-processing.repository.js';
import { WorkerHeartbeatService } from './modules/health/infrastructure/worker-heartbeat.service.js';

@Module({
  imports: [InfrastructureModule],
  providers: [
    DocumentProcessingService,
    WorkerHeartbeatService,
    BullMqProcessingWorker,
    LinuxPdfProcessor,
    NodePdfPasswordVault,
    PrismaProcessingRepository,
    S3DocumentStorage,
    { provide: DOCUMENT_STORAGE, useExisting: S3DocumentStorage },
    { provide: PDF_ENCRYPTION_KEY, useFactory: () => loadEnvironment().pdfEncryptionKey },
    { provide: PDF_PASSWORD_VAULT, useExisting: NodePdfPasswordVault },
    { provide: PDF_PROCESSOR, useExisting: LinuxPdfProcessor },
    { provide: PROCESSING_REPOSITORY, useExisting: PrismaProcessingRepository },
  ],
})
export class WorkerModule {}
