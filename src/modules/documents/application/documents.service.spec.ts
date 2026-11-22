import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditWriter } from '../../auth/application/audit-writer.js';
import { Role } from '../../access-control/domain/access-control.js';
import type { DocumentQueue } from './document-queue.js';
import type { DocumentStorage } from './document-storage.js';
import type {
  CreateDocumentRecord,
  DocumentAccessRecord,
  DocumentRepository,
  ManagedDocument,
  PatientOption,
} from './document.repository.js';
import {
  DocumentsService,
  maximumManualProcessingRetries,
  type CreateDocumentInput,
  type UploadedPdf,
} from './documents.service.js';
import { DocumentType, UploadAction } from '../domain/document.js';

const patient: PatientOption = {
  clinicalCode: 'PAT-2026-ABC234',
  email: 'patient@example.test',
  fullName: 'Jane Patient',
  id: '5c005789-0b5c-4bd1-85f1-8f389be2c74c',
};
const context = {
  actorId: 'd0d20f2a-7c54-4055-8cd7-0f505bd2efcf',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
};
const operatorPrincipal = {
  absoluteExpiresAt: '2026-11-22T12:00:00.000Z',
  email: 'operator@example.test',
  fullName: 'Olivia Operator',
  id: context.actorId,
  mustChangePassword: false,
  role: Role.Operator,
  sessionVersion: 0,
};
const patientPrincipal = {
  ...operatorPrincipal,
  email: patient.email,
  fullName: patient.fullName,
  id: patient.id,
  role: Role.Patient,
};
const validInput: CreateDocumentInput = {
  action: UploadAction.Process,
  description: 'Routine analysis',
  documentDate: '2026-11-20',
  examType: 'Complete blood count',
  patientId: patient.id,
  title: 'Laboratory results',
  type: DocumentType.LabResult,
};
const validFile: UploadedPdf = {
  buffer: Buffer.from('%PDF-1.4\nsynthetic test file'),
  mimetype: 'application/pdf',
  originalname: 'result.pdf',
  size: 28,
};

function createManagedDocument(
  input: CreateDocumentRecord,
  status: ManagedDocument['status'],
): ManagedDocument {
  return {
    annulledAt: null,
    annulmentReason: null,
    createdAt: new Date('2026-11-21T12:00:00.000Z'),
    description: input.description,
    documentDate: input.documentDate,
    examType: input.examType,
    fileSizeBytes: input.fileSizeBytes,
    id: input.id,
    pageCount: null,
    patient,
    procedureName: input.procedureName,
    publishedAt: null,
    replacement: null,
    status,
    title: input.title,
    type: input.type,
  };
}

function createAccessRecord(overrides: Partial<DocumentAccessRecord> = {}): DocumentAccessRecord {
  return {
    id: '4bb53674-6230-4ea8-a66b-695edf50fdc6',
    passwordAuthTag: 'auth-tag',
    passwordCiphertext: 'ciphertext',
    passwordInitialization: 'initialization',
    patientId: patient.id,
    previewObjectKey: 'preview.webp',
    protectedObjectKey: 'protected.pdf',
    status: 'PUBLISHED',
    title: 'Laboratory results',
    ...overrides,
  };
}

function createTestDocument(status: ManagedDocument['status']): ManagedDocument {
  return createManagedDocument(
    {
      description: validInput.description ?? null,
      documentDate: new Date(`${validInput.documentDate}T00:00:00.000Z`),
      examType: validInput.examType ?? null,
      fileSizeBytes: validFile.size,
      id: createAccessRecord().id,
      originalObjectKey: 'original.pdf',
      patientId: patient.id,
      procedureName: null,
      queueForProcessing: true,
      title: validInput.title,
      type: validInput.type,
      uploadedById: context.actorId,
    },
    status,
  );
}

describe('DocumentsService', () => {
  let annulDocument: ReturnType<typeof vi.fn<DocumentRepository['annul']>>;
  let auditWrite: ReturnType<typeof vi.fn<AuditWriter['write']>>;
  let createDocument: ReturnType<typeof vi.fn<DocumentRepository['create']>>;
  let deleteDocument: ReturnType<typeof vi.fn<DocumentRepository['deleteRecoverable']>>;
  let deleteObject: ReturnType<typeof vi.fn<DocumentStorage['delete']>>;
  let enqueue: ReturnType<typeof vi.fn<DocumentQueue['enqueue']>>;
  let findAccessById: ReturnType<typeof vi.fn<DocumentRepository['findAccessById']>>;
  let findById: ReturnType<typeof vi.fn<DocumentRepository['findById']>>;
  let getObject: ReturnType<typeof vi.fn<DocumentStorage['get']>>;
  let listDocuments: ReturnType<typeof vi.fn<DocumentRepository['list']>>;
  let markQueueFailed: ReturnType<typeof vi.fn<DocumentRepository['markQueueFailed']>>;
  let publishDocument: ReturnType<typeof vi.fn<DocumentRepository['publish']>>;
  let retryDocument: ReturnType<typeof vi.fn<DocumentRepository['retry']>>;
  let searchActivePatients: ReturnType<typeof vi.fn<DocumentRepository['searchActivePatients']>>;
  let service: DocumentsService;
  let storeObject: ReturnType<typeof vi.fn<DocumentStorage['store']>>;
  let unprotectPassword: ReturnType<
    typeof vi.fn<
      (password: { authTag: string; ciphertext: string; initialization: string }) => string
    >
  >;

  beforeEach(() => {
    annulDocument = vi.fn<DocumentRepository['annul']>().mockResolvedValue(null);
    auditWrite = vi.fn<AuditWriter['write']>().mockResolvedValue(undefined);
    createDocument = vi.fn<DocumentRepository['create']>().mockImplementation((input) =>
      Promise.resolve({
        document: createManagedDocument(input, input.queueForProcessing ? 'PENDING' : 'DRAFT'),
        kind: 'CREATED',
        processingJobId: input.queueForProcessing ? '40a82a20-9b53-4a84-bd63-e7199e5ccb69' : null,
      }),
    );
    deleteDocument = vi
      .fn<DocumentRepository['deleteRecoverable']>()
      .mockResolvedValue({ kind: 'NOT_FOUND' });
    markQueueFailed = vi
      .fn<DocumentRepository['markQueueFailed']>()
      .mockImplementation((documentId) =>
        Promise.resolve({
          annulledAt: null,
          annulmentReason: null,
          createdAt: new Date('2026-11-21T12:00:00.000Z'),
          description: validInput.description ?? null,
          documentDate: new Date('2026-11-20T00:00:00.000Z'),
          examType: validInput.examType ?? null,
          fileSizeBytes: validFile.size,
          id: documentId,
          pageCount: null,
          patient,
          procedureName: null,
          publishedAt: null,
          replacement: null,
          status: 'FAILED',
          title: validInput.title,
          type: validInput.type,
        }),
      );
    searchActivePatients = vi
      .fn<DocumentRepository['searchActivePatients']>()
      .mockResolvedValue([patient]);
    enqueue = vi.fn<DocumentQueue['enqueue']>().mockResolvedValue(undefined);
    deleteObject = vi.fn<DocumentStorage['delete']>().mockResolvedValue(undefined);
    getObject = vi.fn<DocumentStorage['get']>().mockResolvedValue(Buffer.from('stored object'));
    storeObject = vi.fn<DocumentStorage['store']>().mockResolvedValue(undefined);
    findAccessById = vi.fn<DocumentRepository['findAccessById']>().mockResolvedValue(null);
    findById = vi.fn<DocumentRepository['findById']>().mockResolvedValue(null);
    listDocuments = vi.fn<DocumentRepository['list']>().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
    publishDocument = vi.fn<DocumentRepository['publish']>().mockResolvedValue(null);
    retryDocument = vi.fn<DocumentRepository['retry']>().mockResolvedValue({ kind: 'NOT_FOUND' });
    unprotectPassword = vi.fn().mockReturnValue('AbCdEfGh23456789');

    const documents: DocumentRepository = {
      annul: annulDocument,
      create: createDocument,
      deleteRecoverable: deleteDocument,
      findAccessById,
      findActivePatientById: vi.fn().mockResolvedValue(patient),
      findById,
      findReplacementCandidates: vi.fn().mockResolvedValue([]),
      list: listDocuments,
      markQueueFailed,
      publish: publishDocument,
      retry: retryDocument,
      searchActivePatients,
    };
    service = new DocumentsService(
      documents,
      { delete: deleteObject, get: getObject, store: storeObject },
      { enqueue },
      { write: auditWrite },
      { protect: vi.fn(), unprotect: unprotectPassword },
    );
  });

  it('searches only when at least two characters are provided', async () => {
    await expect(service.searchPatients('a')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.searchPatients(' jane ')).resolves.toEqual([patient]);
    expect(searchActivePatients).toHaveBeenCalledWith('jane');
  });

  it('lists published and annulled document history owned by a patient', async () => {
    await service.list(
      { page: 2, pageSize: 20, search: ' blood ', status: 'FAILED' },
      patientPrincipal,
    );

    expect(listDocuments).toHaveBeenCalledWith({
      page: 2,
      pageSize: 20,
      patientId: patient.id,
      patientHistoryOnly: true,
      search: 'blood',
    });
  });

  it('lists all documents for an operator', async () => {
    await service.list({ page: 1, pageSize: 20 }, operatorPrincipal);

    expect(listDocuments).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('hides an unpublished replacement from patient history', async () => {
    const annulled = {
      ...createTestDocument('ANNULLED'),
      replacement: {
        documentDate: new Date('2026-11-22T00:00:00.000Z'),
        id: '3385d1d9-5dcf-43eb-8184-73a635cb4671',
        status: 'PROCESSING' as const,
        title: 'Corrected laboratory results',
      },
    };
    listDocuments.mockResolvedValueOnce({
      items: [annulled],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });

    const result = await service.list({ page: 1, pageSize: 20 }, patientPrincipal);

    expect(result.items[0]?.replacement).toBeNull();
  });

  it('returns metadata to the owning patient only after publication', async () => {
    const published = createManagedDocument(
      {
        description: null,
        documentDate: new Date('2026-11-20T00:00:00.000Z'),
        examType: 'Complete blood count',
        fileSizeBytes: validFile.size,
        id: createAccessRecord().id,
        originalObjectKey: 'original.pdf',
        patientId: patient.id,
        procedureName: null,
        queueForProcessing: true,
        title: validInput.title,
        type: DocumentType.LabResult,
        uploadedById: context.actorId,
      },
      'PUBLISHED',
    );
    findById.mockResolvedValueOnce(published);

    await expect(service.getById(published.id, patientPrincipal)).resolves.toBe(published);

    const annulled = {
      ...published,
      annulledAt: new Date('2026-11-22T15:00:00.000Z'),
      annulmentReason: 'Incorrect patient information',
      replacement: {
        documentDate: new Date('2026-11-22T00:00:00.000Z'),
        id: '3385d1d9-5dcf-43eb-8184-73a635cb4671',
        status: 'PROCESSING' as const,
        title: 'Corrected laboratory results',
      },
      status: 'ANNULLED' as const,
    };
    findById.mockResolvedValueOnce(annulled);
    await expect(service.getById(annulled.id, patientPrincipal)).resolves.toMatchObject({
      replacement: null,
    });

    const annulledWithPublishedReplacement = {
      ...annulled,
      replacement: { ...annulled.replacement, status: 'PUBLISHED' as const },
    };
    findById.mockResolvedValueOnce(annulledWithPublishedReplacement);
    await expect(
      service.getById(annulledWithPublishedReplacement.id, patientPrincipal),
    ).resolves.toMatchObject({ replacement: annulledWithPublishedReplacement.replacement });

    findById.mockResolvedValueOnce({ ...published, status: 'READY_TO_PUBLISH' });
    await expect(service.getById(published.id, patientPrincipal)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('serves and audits an operator preview', async () => {
    const document = createAccessRecord({ status: 'READY_TO_PUBLISH' });
    findAccessById.mockResolvedValueOnce(document);

    await expect(service.getPreview(document.id, operatorPrincipal, context)).resolves.toEqual({
      body: Buffer.from('stored object'),
      filename: `mediagnostics-${document.id}-preview.webp`,
    });
    expect(getObject).toHaveBeenCalledWith('preview.webp');
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'document.preview', actorId: operatorPrincipal.id }),
    );
  });

  it('rejects a preview that has not been generated', async () => {
    findAccessById.mockResolvedValueOnce(
      createAccessRecord({ previewObjectKey: null, status: 'READY_TO_PUBLISH' }),
    );

    await expect(
      service.getPreview(createAccessRecord().id, operatorPrincipal, context),
    ).rejects.toMatchObject({ response: { code: 'DOCUMENT_PREVIEW_UNAVAILABLE' } });
  });

  it('serves and audits a protected PDF to its patient', async () => {
    const document = createAccessRecord();
    findAccessById.mockResolvedValueOnce(document);

    await expect(service.download(document.id, patientPrincipal, context)).resolves.toEqual({
      body: Buffer.from('stored object'),
      filename: `mediagnostics-${document.id}.pdf`,
    });
    expect(getObject).toHaveBeenCalledWith('protected.pdf');
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'document.download', actorId: patient.id }),
    );
  });

  it('exposes annulled metadata but blocks all patient content access', async () => {
    const annulled = createAccessRecord({ status: 'ANNULLED' });
    findAccessById.mockResolvedValue(annulled);

    await expect(service.getPreview(annulled.id, patientPrincipal, context)).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.download(annulled.id, patientPrincipal, context)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      service.revealPassword(annulled.id, patientPrincipal, context),
    ).rejects.toMatchObject({ status: 404 });
    expect(getObject).not.toHaveBeenCalled();
    expect(unprotectPassword).not.toHaveBeenCalled();
  });

  it('rejects a protected PDF that is unavailable', async () => {
    findAccessById.mockResolvedValueOnce(createAccessRecord({ protectedObjectKey: null }));

    await expect(
      service.download(createAccessRecord().id, patientPrincipal, context),
    ).rejects.toMatchObject({ response: { code: 'DOCUMENT_DOWNLOAD_UNAVAILABLE' } });
  });

  it('reveals and audits a published patient document password', async () => {
    findAccessById.mockResolvedValueOnce(createAccessRecord());

    await expect(
      service.revealPassword('4bb53674-6230-4ea8-a66b-695edf50fdc6', patientPrincipal, context),
    ).resolves.toBe('AbCdEfGh23456789');
    expect(unprotectPassword).toHaveBeenCalledOnce();
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'document.password-reveal', actorId: patient.id }),
    );
  });

  it('audits a patient password copy', async () => {
    findAccessById.mockResolvedValueOnce(createAccessRecord());

    await service.recordPasswordCopy(createAccessRecord().id, patientPrincipal, context);

    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'document.password-copy', actorId: patient.id }),
    );
  });

  it('does not reveal a document password to an operator', async () => {
    findAccessById.mockResolvedValueOnce(createAccessRecord());

    await expect(
      service.revealPassword(createAccessRecord().id, operatorPrincipal, context),
    ).rejects.toMatchObject({ status: 404 });
    expect(unprotectPassword).not.toHaveBeenCalled();
  });

  it.each([
    { passwordAuthTag: null },
    { passwordCiphertext: null },
    { passwordInitialization: null },
  ])('rejects incomplete protected password data: %o', async (overrides) => {
    findAccessById.mockResolvedValueOnce(createAccessRecord(overrides));

    await expect(
      service.revealPassword(createAccessRecord().id, patientPrincipal, context),
    ).rejects.toMatchObject({ response: { code: 'DOCUMENT_PASSWORD_UNAVAILABLE' } });
  });

  it('publishes a document that completed processing', async () => {
    const accessRecord = createAccessRecord({ status: 'READY_TO_PUBLISH' });
    const published = createManagedDocument(
      {
        description: null,
        documentDate: new Date('2026-11-20T00:00:00.000Z'),
        examType: 'Complete blood count',
        fileSizeBytes: validFile.size,
        id: accessRecord.id,
        originalObjectKey: 'original.pdf',
        patientId: patient.id,
        procedureName: null,
        queueForProcessing: true,
        title: 'Laboratory results',
        type: DocumentType.LabResult,
        uploadedById: context.actorId,
      },
      'PUBLISHED',
    );
    findAccessById.mockResolvedValueOnce(accessRecord);
    publishDocument.mockResolvedValueOnce(published);

    await expect(service.publish(accessRecord.id, context)).resolves.toBe(published);
    expect(publishDocument).toHaveBeenCalledWith(accessRecord.id, expect.any(Date));
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'document.publish', result: 'SUCCESS' }),
    );
  });

  it('rejects publication when processing is incomplete', async () => {
    findAccessById.mockResolvedValueOnce(createAccessRecord({ status: 'PROCESSING' }));

    await expect(service.publish(createAccessRecord().id, context)).rejects.toMatchObject({
      response: { code: 'DOCUMENT_NOT_READY_TO_PUBLISH' },
    });
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'document.publish', result: 'FAILURE' }),
    );
  });

  it('rejects a concurrent publication status change', async () => {
    findAccessById.mockResolvedValueOnce(createAccessRecord({ status: 'READY_TO_PUBLISH' }));
    publishDocument.mockResolvedValueOnce(null);

    await expect(service.publish(createAccessRecord().id, context)).rejects.toMatchObject({
      response: { code: 'DOCUMENT_PUBLICATION_CONFLICT' },
    });
  });

  it('annuls a published document with a normalized reason', async () => {
    const accessRecord = createAccessRecord({ status: 'PUBLISHED' });
    const annulled = {
      ...createTestDocument('ANNULLED'),
      annulledAt: new Date('2026-11-22T15:00:00.000Z'),
      annulmentReason: 'Incorrect patient information',
    };
    findAccessById.mockResolvedValueOnce(accessRecord);
    annulDocument.mockResolvedValueOnce(annulled);

    await expect(
      service.annul(accessRecord.id, '  Incorrect   patient information  ', context),
    ).resolves.toBe(annulled);
    expect(annulDocument).toHaveBeenCalledWith(
      accessRecord.id,
      context.actorId,
      'Incorrect patient information',
      expect.any(Date),
    );
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'document.annul',
        metadata: {
          patientId: accessRecord.patientId,
          reason: 'Incorrect patient information',
        },
        result: 'SUCCESS',
      }),
    );
  });

  it('rejects an annulment reason that is too short', async () => {
    await expect(
      service.annul(createAccessRecord().id, 'Too short', context),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_ANNULMENT_REASON' },
    });
    expect(annulDocument).not.toHaveBeenCalled();
  });

  it('rejects annulment unless the document is published', async () => {
    findAccessById.mockResolvedValueOnce(createAccessRecord({ status: 'READY_TO_PUBLISH' }));

    await expect(
      service.annul(createAccessRecord().id, 'The result contains incorrect data', context),
    ).rejects.toMatchObject({ response: { code: 'DOCUMENT_NOT_ANNULABLE' } });
    expect(annulDocument).not.toHaveBeenCalled();
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'document.annul', result: 'FAILURE' }),
    );
  });

  it('retries a failed document and audits the new processing job', async () => {
    const pendingDocument = createTestDocument('PENDING');
    retryDocument.mockResolvedValueOnce({
      document: pendingDocument,
      kind: 'CREATED',
      processingJobId: '72ea6ef2-c749-4e7e-9815-d30df3577543',
    });

    await expect(service.retry(pendingDocument.id, context)).resolves.toBe(pendingDocument);
    expect(retryDocument).toHaveBeenCalledWith(pendingDocument.id, maximumManualProcessingRetries);
    expect(enqueue).toHaveBeenCalledWith({
      documentId: pendingDocument.id,
      processingJobId: '72ea6ef2-c749-4e7e-9815-d30df3577543',
    });
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'document.processing-retry', result: 'SUCCESS' }),
    );
  });

  it('rejects a retry after the manual limit is reached', async () => {
    retryDocument.mockResolvedValueOnce({ kind: 'LIMIT_REACHED' });

    await expect(service.retry(createAccessRecord().id, context)).rejects.toMatchObject({
      response: { code: 'DOCUMENT_RETRY_LIMIT_REACHED' },
    });
    expect(enqueue).not.toHaveBeenCalled();
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'document.processing-retry', result: 'FAILURE' }),
    );
  });

  it('audits a retry rejected because the document is no longer failed', async () => {
    retryDocument.mockResolvedValueOnce({ kind: 'INVALID_STATUS' });

    await expect(service.retry(createAccessRecord().id, context)).rejects.toMatchObject({
      response: { code: 'DOCUMENT_NOT_RETRYABLE' },
    });
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'document.processing-retry',
        metadata: { reason: 'INVALID_DOCUMENT_STATUS' },
        result: 'FAILURE',
      }),
    );
  });

  it('restores failed status when a retried job cannot be queued', async () => {
    const pendingDocument = createTestDocument('PENDING');
    const failedDocument = { ...pendingDocument, status: 'FAILED' as const };
    retryDocument.mockResolvedValueOnce({
      document: pendingDocument,
      kind: 'CREATED',
      processingJobId: '72ea6ef2-c749-4e7e-9815-d30df3577543',
    });
    markQueueFailed.mockResolvedValueOnce(failedDocument);
    enqueue.mockRejectedValueOnce(new Error('redis unavailable'));

    await expect(service.retry(pendingDocument.id, context)).resolves.toBe(failedDocument);
    expect(markQueueFailed).toHaveBeenCalledWith(
      pendingDocument.id,
      '72ea6ef2-c749-4e7e-9815-d30df3577543',
      'redis unavailable',
    );
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'document.processing-retry', result: 'FAILURE' }),
    );
  });

  it('permanently deletes a failed document and its stored objects', async () => {
    const accessRecord = createAccessRecord({ status: 'FAILED' });
    findAccessById.mockResolvedValueOnce(accessRecord);
    deleteDocument.mockResolvedValueOnce({
      kind: 'DELETED',
      objectKeys: ['original.pdf', 'preview.webp', 'protected.pdf'],
    });

    await expect(service.deleteRecoverable(accessRecord.id, context)).resolves.toBeUndefined();
    expect(deleteObject).toHaveBeenCalledTimes(3);
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'document.delete-request', result: 'SUCCESS' }),
    );
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'document.delete', result: 'SUCCESS' }),
    );
  });

  it('rejects deletion for a document that must be preserved', async () => {
    const accessRecord = createAccessRecord({ status: 'PUBLISHED' });
    findAccessById.mockResolvedValueOnce(accessRecord);

    await expect(service.deleteRecoverable(accessRecord.id, context)).rejects.toMatchObject({
      response: { code: 'DOCUMENT_NOT_DELETABLE' },
    });
    expect(deleteDocument).not.toHaveBeenCalled();
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it('audits a concurrent status change during deletion', async () => {
    const accessRecord = createAccessRecord({ status: 'FAILED' });
    findAccessById.mockResolvedValueOnce(accessRecord);
    deleteDocument.mockResolvedValueOnce({ kind: 'INVALID_STATUS' });

    await expect(service.deleteRecoverable(accessRecord.id, context)).rejects.toMatchObject({
      response: { code: 'DOCUMENT_DELETION_CONFLICT' },
    });
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'document.delete',
        metadata: { reason: 'CONCURRENT_STATUS_CHANGE' },
        result: 'FAILURE',
      }),
    );
  });

  it('audits an object cleanup failure after deleting a recoverable document', async () => {
    const accessRecord = createAccessRecord({ status: 'DRAFT' });
    findAccessById.mockResolvedValueOnce(accessRecord);
    deleteDocument.mockResolvedValueOnce({ kind: 'DELETED', objectKeys: ['original.pdf'] });
    deleteObject.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(service.deleteRecoverable(accessRecord.id, context)).rejects.toThrow(
      'storage unavailable',
    );
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'document.delete', result: 'FAILURE' }),
    );
  });

  it.each([
    [{ ...validInput, documentDate: '2099-01-01' }, 'INVALID_DOCUMENT_DATE'],
    [{ ...validInput, title: ' ' }, 'DOCUMENT_TITLE_REQUIRED'],
    [{ ...validInput, examType: ' ' }, 'EXAM_TYPE_REQUIRED'],
    [
      {
        ...validInput,
        procedureName: ' ',
        type: DocumentType.InformedConsent,
      },
      'PROCEDURE_NAME_REQUIRED',
    ],
  ] as const)('rejects invalid document metadata', async (input, code) => {
    await expect(service.create(input, validFile, context)).rejects.toMatchObject({
      response: { code },
    });
    expect(storeObject).not.toHaveBeenCalled();
  });

  it('stores a draft without enqueueing a processing job', async () => {
    const result = await service.create(
      { ...validInput, action: UploadAction.Draft },
      validFile,
      context,
    );

    expect(result.status).toBe('DRAFT');
    const storedFile = storeObject.mock.calls[0]?.[0];
    expect(storedFile?.body).toBe(validFile.buffer);
    expect(storedFile?.key).toMatch(
      new RegExp(`^patients/${patient.id}/documents/[0-9a-f-]+/original\\.pdf$`),
    );
    const createInput = createDocument.mock.calls[0]?.[0];
    expect(createInput?.patientId).toBe(patient.id);
    expect(createInput?.queueForProcessing).toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('creates and enqueues a processing job', async () => {
    const result = await service.create(validInput, validFile, context);

    expect(result.status).toBe('PENDING');
    expect(enqueue).toHaveBeenCalledWith({
      documentId: result.id,
      processingJobId: '40a82a20-9b53-4a84-bd63-e7199e5ccb69',
    });
  });

  it('rejects content that does not have a PDF signature', async () => {
    await expect(
      service.create(
        { ...validInput },
        { ...validFile, buffer: Buffer.from('not a pdf') },
        context,
      ),
    ).rejects.toMatchObject({ response: { code: 'INVALID_PDF_TYPE' } });
    expect(storeObject).not.toHaveBeenCalled();
  });

  it('deletes the S3 object when the database transaction fails', async () => {
    createDocument.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(service.create(validInput, validFile, context)).rejects.toThrow(
      'database unavailable',
    );
    expect(deleteObject).toHaveBeenCalledOnce();
  });

  it('rejects a replacement that is no longer eligible and removes the uploaded object', async () => {
    createDocument.mockResolvedValueOnce({ kind: 'INVALID_REPLACEMENT' });

    await expect(
      service.create(
        {
          ...validInput,
          replacesId: 'd4807490-f8a6-4c73-91f7-d885c732dcab',
        },
        validFile,
        context,
      ),
    ).rejects.toMatchObject({ response: { code: 'INVALID_REPLACEMENT' } });
    expect(deleteObject).toHaveBeenCalledOnce();
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'document.create',
        metadata: { reason: 'INVALID_REPLACEMENT' },
        result: 'FAILURE',
      }),
    );
  });

  it('persists and audits an eligible replacement link', async () => {
    const replacesId = 'd4807490-f8a6-4c73-91f7-d885c732dcab';

    await service.create({ ...validInput, replacesId }, validFile, context);

    expect(createDocument).toHaveBeenCalledWith(expect.objectContaining({ replacesId }));
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { patientId: patient.id, replacesId, type: DocumentType.LabResult },
        result: 'SUCCESS',
      }),
    );
  });

  it('marks the document as failed when Redis cannot enqueue the job', async () => {
    enqueue.mockRejectedValueOnce(new Error('redis unavailable'));

    const result = await service.create(validInput, validFile, context);

    expect(result.status).toBe('FAILED');
    expect(markQueueFailed).toHaveBeenCalledWith(
      result.id,
      '40a82a20-9b53-4a84-bd63-e7199e5ccb69',
      'redis unavailable',
    );
    const auditEntry = auditWrite.mock.calls.at(-1)?.[0];
    expect(auditEntry?.action).toBe('document.processing-queue');
    expect(auditEntry?.metadata).toEqual({ reason: 'QUEUE_UNAVAILABLE' });
    expect(auditEntry?.result).toBe('FAILURE');
  });
});
