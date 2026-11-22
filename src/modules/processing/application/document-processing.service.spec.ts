import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProcessDocumentJobData } from '../../documents/application/document-queue.js';
import type { DocumentStorage } from '../../documents/application/document-storage.js';
import { DocumentProcessingService } from './document-processing.service.js';
import type { PdfPasswordVault, ProtectedPassword } from './pdf-password-vault.js';
import { PermanentProcessingError, type PdfProcessor } from './pdf-processor.js';
import type { ProcessingRepository } from './processing.repository.js';

const job: ProcessDocumentJobData = {
  documentId: '4bb53674-6230-4ea8-a66b-695edf50fdc6',
  processingJobId: '10115298-5a0e-4be4-b735-1e3c4962dc6e',
};
const original = Buffer.from('%PDF-1.4 synthetic');
const protectedPassword: ProtectedPassword = {
  authTag: 'tag',
  ciphertext: 'ciphertext',
  initialization: 'initialization',
};

describe('DocumentProcessingService', () => {
  let complete: ReturnType<typeof vi.fn<ProcessingRepository['complete']>>;
  let deleteObject: ReturnType<typeof vi.fn<DocumentStorage['delete']>>;
  let fail: ReturnType<typeof vi.fn<ProcessingRepository['fail']>>;
  let processPdf: ReturnType<typeof vi.fn<PdfProcessor['process']>>;
  let protectPassword: ReturnType<typeof vi.fn<PdfPasswordVault['protect']>>;
  let service: DocumentProcessingService;
  let storeObject: ReturnType<typeof vi.fn<DocumentStorage['store']>>;

  beforeEach(() => {
    complete = vi.fn<ProcessingRepository['complete']>().mockResolvedValue(undefined);
    deleteObject = vi.fn<DocumentStorage['delete']>().mockResolvedValue(undefined);
    fail = vi.fn<ProcessingRepository['fail']>().mockResolvedValue(undefined);
    processPdf = vi.fn<PdfProcessor['process']>().mockResolvedValue({
      pageCount: 2,
      preview: Buffer.from('webp'),
      protectedPdf: Buffer.from('protected pdf'),
      sha256: 'abc123',
    });
    protectPassword = vi.fn<PdfPasswordVault['protect']>().mockReturnValue(protectedPassword);
    storeObject = vi.fn<DocumentStorage['store']>().mockResolvedValue(undefined);

    const repository: ProcessingRepository = {
      begin: vi.fn().mockResolvedValue({
        id: job.documentId,
        originalObjectKey: `patients/patient/documents/${job.documentId}/original.pdf`,
        patientId: 'patient',
      }),
      complete,
      fail,
    };
    service = new DocumentProcessingService(
      repository,
      {
        delete: deleteObject,
        get: vi.fn().mockResolvedValue(original),
        store: storeObject,
      },
      { process: processPdf },
      { protect: protectPassword, unprotect: vi.fn() },
    );
  });

  it('stores processed artifacts and completes the job', async () => {
    await service.process(job, false);

    const password = processPdf.mock.calls[0]?.[1];
    expect(password).toMatch(/^[A-HJ-NP-Za-km-z2-9]{16}$/);
    expect(protectPassword).toHaveBeenCalledWith(password);
    expect(storeObject).toHaveBeenCalledTimes(2);
    expect(complete).toHaveBeenCalledWith({
      documentId: job.documentId,
      pageCount: 2,
      password: protectedPassword,
      previewObjectKey: `patients/patient/documents/${job.documentId}/preview.webp`,
      processingJobId: job.processingJobId,
      protectedObjectKey: `patients/patient/documents/${job.documentId}/protected.pdf`,
      sha256: 'abc123',
    });
  });

  it('marks unsafe PDFs as permanently failed', async () => {
    processPdf.mockRejectedValueOnce(
      new PermanentProcessingError('PDF_ACTIVE_CONTENT', 'Active content found.'),
    );

    await expect(service.process(job, false)).rejects.toBeInstanceOf(PermanentProcessingError);
    expect(fail).toHaveBeenCalledWith(
      job.documentId,
      job.processingJobId,
      'PDF_ACTIVE_CONTENT',
      'Active content found.',
      true,
    );
  });

  it('keeps transient failures pending before the final attempt', async () => {
    storeObject.mockRejectedValueOnce(new Error('S3 unavailable'));

    await expect(service.process(job, false)).rejects.toThrow('S3 unavailable');
    expect(fail).toHaveBeenCalledWith(
      job.documentId,
      job.processingJobId,
      'PROCESSING_FAILED',
      'S3 unavailable',
      false,
    );
    expect(deleteObject).not.toHaveBeenCalled();
  });
});
