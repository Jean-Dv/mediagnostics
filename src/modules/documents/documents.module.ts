import { Module } from '@nestjs/common';

import { loadEnvironment } from '../../common/config/environment.js';
import { AuthModule } from '../auth/auth.module.js';
import {
  PDF_ENCRYPTION_KEY,
  PDF_PASSWORD_VAULT,
} from '../processing/application/pdf-password-vault.js';
import { NodePdfPasswordVault } from '../processing/infrastructure/node-pdf-password.vault.js';
import { DOCUMENT_QUEUE } from './application/document-queue.js';
import { DOCUMENT_STORAGE } from './application/document-storage.js';
import { DOCUMENT_REPOSITORY } from './application/document.repository.js';
import { DocumentsService } from './application/documents.service.js';
import { BullMqDocumentQueue } from './infrastructure/bullmq-document.queue.js';
import { PrismaDocumentRepository } from './infrastructure/prisma-document.repository.js';
import { S3DocumentStorage } from './infrastructure/s3-document.storage.js';
import { DocumentsController } from './presentation/documents.controller.js';

@Module({
  controllers: [DocumentsController],
  imports: [AuthModule],
  providers: [
    DocumentsService,
    BullMqDocumentQueue,
    PrismaDocumentRepository,
    S3DocumentStorage,
    NodePdfPasswordVault,
    { provide: DOCUMENT_QUEUE, useExisting: BullMqDocumentQueue },
    { provide: DOCUMENT_REPOSITORY, useExisting: PrismaDocumentRepository },
    { provide: DOCUMENT_STORAGE, useExisting: S3DocumentStorage },
    { provide: PDF_ENCRYPTION_KEY, useFactory: () => loadEnvironment().pdfEncryptionKey },
    { provide: PDF_PASSWORD_VAULT, useExisting: NodePdfPasswordVault },
  ],
  exports: [S3DocumentStorage],
})
export class DocumentsModule {}
