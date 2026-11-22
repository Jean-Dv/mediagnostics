import type { ProtectedPassword } from './pdf-password-vault.js';

export const PROCESSING_REPOSITORY = Symbol('PROCESSING_REPOSITORY');

export interface ProcessableDocument {
  id: string;
  originalObjectKey: string;
  patientId: string;
}

export interface CompleteProcessingInput {
  documentId: string;
  pageCount: number;
  password: ProtectedPassword;
  previewObjectKey: string;
  processingJobId: string;
  protectedObjectKey: string;
  sha256: string;
}

export interface ProcessingRepository {
  begin(documentId: string, processingJobId: string): Promise<ProcessableDocument | null>;
  complete(input: CompleteProcessingInput): Promise<void>;
  fail(
    documentId: string,
    processingJobId: string,
    errorCode: string,
    errorMessage: string,
    finalAttempt: boolean,
  ): Promise<void>;
}
