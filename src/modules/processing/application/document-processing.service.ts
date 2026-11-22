import { randomInt } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import type { ProcessDocumentJobData } from '../../documents/application/document-queue.js';
import {
  DOCUMENT_STORAGE,
  type DocumentStorage,
} from '../../documents/application/document-storage.js';
import { PDF_PASSWORD_VAULT, type PdfPasswordVault } from './pdf-password-vault.js';
import { PDF_PROCESSOR, PermanentProcessingError, type PdfProcessor } from './pdf-processor.js';
import { PROCESSING_REPOSITORY, type ProcessingRepository } from './processing.repository.js';

const passwordAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const passwordLength = 16;

@Injectable()
export class DocumentProcessingService {
  public constructor(
    @Inject(PROCESSING_REPOSITORY)
    private readonly repository: ProcessingRepository,
    @Inject(DOCUMENT_STORAGE)
    private readonly storage: DocumentStorage,
    @Inject(PDF_PROCESSOR)
    private readonly processor: PdfProcessor,
    @Inject(PDF_PASSWORD_VAULT)
    private readonly passwordVault: PdfPasswordVault,
  ) {}

  public async process(data: ProcessDocumentJobData, finalAttempt: boolean): Promise<void> {
    const document = await this.repository.begin(data.documentId, data.processingJobId);
    if (document === null) {
      throw new PermanentProcessingError(
        'DOCUMENT_NOT_PROCESSABLE',
        'The document is missing or cannot be processed in its current state.',
      );
    }

    const baseKey = `patients/${document.patientId}/documents/${document.id}`;
    const protectedObjectKey = `${baseKey}/protected.pdf`;
    const previewObjectKey = `${baseKey}/preview.webp`;
    let protectedStored = false;
    let previewStored = false;

    try {
      const original = await this.storage.get(document.originalObjectKey);
      const password = this.generatePassword();
      const processed = await this.processor.process(original, password);
      const protectedPassword = this.passwordVault.protect(password);

      await this.storage.store({
        body: processed.protectedPdf,
        contentType: 'application/pdf',
        key: protectedObjectKey,
      });
      protectedStored = true;
      await this.storage.store({
        body: processed.preview,
        contentType: 'image/webp',
        key: previewObjectKey,
      });
      previewStored = true;

      await this.repository.complete({
        documentId: document.id,
        pageCount: processed.pageCount,
        password: protectedPassword,
        previewObjectKey,
        processingJobId: data.processingJobId,
        protectedObjectKey,
        sha256: processed.sha256,
      });
    } catch (error: unknown) {
      if (previewStored) await this.storage.delete(previewObjectKey).catch(() => undefined);
      if (protectedStored) await this.storage.delete(protectedObjectKey).catch(() => undefined);

      const permanent = error instanceof PermanentProcessingError;
      await this.repository.fail(
        document.id,
        data.processingJobId,
        permanent ? error.code : 'PROCESSING_FAILED',
        error instanceof Error ? error.message : 'Document processing failed.',
        finalAttempt || permanent,
      );
      throw error;
    }
  }

  private generatePassword(): string {
    let password = '';
    for (let index = 0; index < passwordLength; index += 1) {
      password += passwordAlphabet.charAt(randomInt(passwordAlphabet.length));
    }
    return password;
  }
}
