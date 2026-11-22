import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/infrastructure/database/prisma.service.js';
import type {
  CompleteProcessingInput,
  ProcessableDocument,
  ProcessingRepository,
} from '../application/processing.repository.js';

@Injectable()
export class PrismaProcessingRepository implements ProcessingRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public begin(documentId: string, processingJobId: string): Promise<ProcessableDocument | null> {
    return this.prisma.$transaction(async (transaction) => {
      const processingJob = await transaction.processingJob.findUnique({
        include: { document: true },
        where: { id: processingJobId },
      });
      if (
        processingJob?.documentId !== documentId ||
        !['PENDING', 'RUNNING'].includes(processingJob.status) ||
        !['PENDING', 'PROCESSING'].includes(processingJob.document.status)
      ) {
        return null;
      }

      await transaction.processingJob.update({
        data: { attempts: { increment: 1 }, startedAt: new Date(), status: 'RUNNING' },
        where: { id: processingJobId },
      });
      await transaction.document.update({
        data: { status: 'PROCESSING' },
        where: { id: documentId },
      });
      return {
        id: processingJob.document.id,
        originalObjectKey: processingJob.document.originalObjectKey,
        patientId: processingJob.document.patientId,
      };
    });
  }

  public complete(input: CompleteProcessingInput): Promise<void> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.document.update({
        data: {
          pageCount: input.pageCount,
          passwordAuthTag: input.password.authTag,
          passwordCiphertext: input.password.ciphertext,
          passwordInitialization: input.password.initialization,
          previewObjectKey: input.previewObjectKey,
          protectedObjectKey: input.protectedObjectKey,
          sha256: input.sha256,
          status: 'READY_TO_PUBLISH',
        },
        where: { id: input.documentId },
      });
      await transaction.processingJob.update({
        data: {
          completedAt: new Date(),
          errorCode: null,
          errorMessage: null,
          status: 'COMPLETED',
        },
        where: { id: input.processingJobId },
      });
    });
  }

  public fail(
    documentId: string,
    processingJobId: string,
    errorCode: string,
    errorMessage: string,
    finalAttempt: boolean,
  ): Promise<void> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.document.update({
        data: { status: finalAttempt ? 'FAILED' : 'PENDING' },
        where: { id: documentId },
      });
      await transaction.processingJob.update({
        data: {
          completedAt: finalAttempt ? new Date() : null,
          errorCode,
          errorMessage: errorMessage.slice(0, 1000),
          status: finalAttempt ? 'FAILED' : 'PENDING',
        },
        where: { id: processingJobId },
      });
    });
  }
}
