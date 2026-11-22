import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { RequestContext } from '../../../common/types/request-context.js';
import type { AuthenticatedPrincipal } from '../../../common/types/authenticated-principal.js';
import { hasPermission, Permission } from '../../access-control/domain/access-control.js';
import { AUDIT_WRITER, type AuditWriter } from '../../auth/application/audit-writer.js';
import {
  PDF_PASSWORD_VAULT,
  type PdfPasswordVault,
  type ProtectedPassword,
} from '../../processing/application/pdf-password-vault.js';
import { DOCUMENT_QUEUE, type DocumentQueue } from './document-queue.js';
import { DOCUMENT_STORAGE, type DocumentStorage } from './document-storage.js';
import {
  DOCUMENT_REPOSITORY,
  type DocumentAccessRecord,
  type DocumentPage,
  type DocumentRepository,
  type ManagedDocument,
  type PatientOption,
} from './document.repository.js';
import { DocumentType, UploadAction } from '../domain/document.js';

export const maximumPdfSizeBytes = 10 * 1024 * 1024;
export const maximumManualProcessingRetries = 3;

export interface DocumentActionContext extends RequestContext {
  actorId: string;
}

export interface ListDocumentsInput {
  page: number;
  pageSize: number;
  search?: string;
  status?: ManagedDocument['status'];
  type?: DocumentType;
}

export interface DocumentAsset {
  body: Buffer;
  filename: string;
}

export interface UploadedPdf {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface CreateDocumentInput {
  action: UploadAction;
  description?: string;
  documentDate: string;
  examType?: string;
  patientId: string;
  procedureName?: string;
  replacesId?: string;
  title: string;
  type: DocumentType;
}

@Injectable()
export class DocumentsService {
  public constructor(
    @Inject(DOCUMENT_REPOSITORY)
    private readonly documents: DocumentRepository,
    @Inject(DOCUMENT_STORAGE)
    private readonly storage: DocumentStorage,
    @Inject(DOCUMENT_QUEUE)
    private readonly queue: DocumentQueue,
    @Inject(AUDIT_WRITER)
    private readonly audit: AuditWriter,
    @Inject(PDF_PASSWORD_VAULT)
    private readonly passwordVault: PdfPasswordVault,
  ) {}

  public async searchPatients(search: string): Promise<PatientOption[]> {
    const normalizedSearch = search.trim();
    if (normalizedSearch.length < 2) {
      throw new BadRequestException({
        code: 'PATIENT_SEARCH_TOO_SHORT',
        message: 'Enter at least 2 characters to search for a patient.',
      });
    }
    return this.documents.searchActivePatients(normalizedSearch);
  }

  public findReplacementCandidates(
    patientId: string,
    type: DocumentType,
  ): Promise<ManagedDocument[]> {
    return this.documents.findReplacementCandidates(patientId, type);
  }

  public async list(
    input: ListDocumentsInput,
    principal: AuthenticatedPrincipal,
  ): Promise<DocumentPage> {
    const search = input.search?.trim().replace(/\s+/g, ' ');
    if (hasPermission(principal.role, Permission.DocumentMetadataReadAll)) {
      return this.documents.list({
        ...input,
        ...(search === undefined || search.length === 0 ? {} : { search }),
      });
    }
    if (hasPermission(principal.role, Permission.DocumentReadOwn)) {
      const page = await this.documents.list({
        page: input.page,
        pageSize: input.pageSize,
        patientId: principal.id,
        patientHistoryOnly: true,
        ...(search === undefined || search.length === 0 ? {} : { search }),
        ...(input.type === undefined ? {} : { type: input.type }),
      });
      return {
        ...page,
        items: page.items.map((document) => this.hideUnpublishedReplacement(document)),
      };
    }
    throw new ForbiddenException('The current role cannot list documents.');
  }

  public async getById(
    documentId: string,
    principal: AuthenticatedPrincipal,
  ): Promise<ManagedDocument> {
    const document = await this.documents.findById(documentId);
    if (document === null || !this.canReadMetadata(document, principal)) {
      throw new NotFoundException('The document does not exist.');
    }
    return hasPermission(principal.role, Permission.DocumentReadOwn)
      ? this.hideUnpublishedReplacement(document)
      : document;
  }

  public async getPreview(
    documentId: string,
    principal: AuthenticatedPrincipal,
    context: RequestContext,
  ): Promise<DocumentAsset> {
    const document = await this.getContentRecord(documentId, principal);
    if (document.previewObjectKey === null) {
      throw new ConflictException({
        code: 'DOCUMENT_PREVIEW_UNAVAILABLE',
        message: 'The document preview is not available.',
      });
    }
    const body = await this.storage.get(document.previewObjectKey);
    await this.writeAccessAudit('document.preview', document, principal.id, context);
    return { body, filename: `mediagnostics-${document.id}-preview.webp` };
  }

  public async download(
    documentId: string,
    principal: AuthenticatedPrincipal,
    context: RequestContext,
  ): Promise<DocumentAsset> {
    const document = await this.getContentRecord(documentId, principal);
    if (document.protectedObjectKey === null) {
      throw new ConflictException({
        code: 'DOCUMENT_DOWNLOAD_UNAVAILABLE',
        message: 'The protected document is not available.',
      });
    }
    const body = await this.storage.get(document.protectedObjectKey);
    await this.writeAccessAudit('document.download', document, principal.id, context);
    return { body, filename: `mediagnostics-${document.id}.pdf` };
  }

  public async revealPassword(
    documentId: string,
    principal: AuthenticatedPrincipal,
    context: RequestContext,
  ): Promise<string> {
    const document = await this.getPatientContentRecord(documentId, principal);
    const protectedPassword = this.getProtectedPassword(document);
    const password = this.passwordVault.unprotect(protectedPassword);
    await this.writeAccessAudit('document.password-reveal', document, principal.id, context);
    return password;
  }

  public async recordPasswordCopy(
    documentId: string,
    principal: AuthenticatedPrincipal,
    context: RequestContext,
  ): Promise<void> {
    const document = await this.getPatientContentRecord(documentId, principal);
    this.getProtectedPassword(document);
    await this.writeAccessAudit('document.password-copy', document, principal.id, context);
  }

  public async publish(
    documentId: string,
    context: DocumentActionContext,
  ): Promise<ManagedDocument> {
    const existing = await this.documents.findAccessById(documentId);
    if (existing === null) throw new NotFoundException('The document does not exist.');
    if (existing.status !== 'READY_TO_PUBLISH') {
      await this.writeAudit(
        'document.publish',
        documentId,
        'FAILURE',
        { reason: 'INVALID_DOCUMENT_STATUS' },
        context,
      );
      throw new ConflictException({
        code: 'DOCUMENT_NOT_READY_TO_PUBLISH',
        message: 'Only processed documents that are ready can be published.',
      });
    }
    const published = await this.documents.publish(documentId, new Date());
    if (published === null) {
      throw new ConflictException({
        code: 'DOCUMENT_PUBLICATION_CONFLICT',
        message: 'The document status changed before it could be published.',
      });
    }
    await this.writeAudit(
      'document.publish',
      documentId,
      'SUCCESS',
      { patientId: existing.patientId },
      context,
    );
    return published;
  }

  public async annul(
    documentId: string,
    reason: string,
    context: DocumentActionContext,
  ): Promise<ManagedDocument> {
    const annulmentReason = reason.trim().replace(/\s+/g, ' ');
    if (annulmentReason.length < 10 || annulmentReason.length > 500) {
      await this.writeAudit(
        'document.annul',
        documentId,
        'FAILURE',
        { reason: 'INVALID_ANNULMENT_REASON' },
        context,
      );
      throw new BadRequestException({
        code: 'INVALID_ANNULMENT_REASON',
        message: 'Annulment reason must contain between 10 and 500 characters.',
      });
    }

    const existing = await this.documents.findAccessById(documentId);
    if (existing === null) {
      await this.writeAudit(
        'document.annul',
        documentId,
        'FAILURE',
        { reason: 'DOCUMENT_NOT_FOUND' },
        context,
      );
      throw new NotFoundException('The document does not exist.');
    }
    if (existing.status !== 'PUBLISHED') {
      await this.writeAudit(
        'document.annul',
        documentId,
        'FAILURE',
        { reason: 'INVALID_DOCUMENT_STATUS' },
        context,
      );
      throw new ConflictException({
        code: 'DOCUMENT_NOT_ANNULABLE',
        message: 'Only published documents can be annulled.',
      });
    }

    const annulled = await this.documents.annul(
      documentId,
      context.actorId,
      annulmentReason,
      new Date(),
    );
    if (annulled === null) {
      await this.writeAudit(
        'document.annul',
        documentId,
        'FAILURE',
        { reason: 'CONCURRENT_STATUS_CHANGE' },
        context,
      );
      throw new ConflictException({
        code: 'DOCUMENT_ANNULMENT_CONFLICT',
        message: 'The document status changed before it could be annulled.',
      });
    }
    await this.writeAudit(
      'document.annul',
      documentId,
      'SUCCESS',
      { patientId: existing.patientId, reason: annulmentReason },
      context,
    );
    return annulled;
  }

  public async retry(documentId: string, context: DocumentActionContext): Promise<ManagedDocument> {
    const result = await this.documents.retry(documentId, maximumManualProcessingRetries);
    if (result.kind === 'NOT_FOUND') {
      await this.writeAudit(
        'document.processing-retry',
        documentId,
        'FAILURE',
        { reason: 'DOCUMENT_NOT_FOUND' },
        context,
      );
      throw new NotFoundException('The document does not exist.');
    }
    if (result.kind === 'INVALID_STATUS') {
      await this.writeAudit(
        'document.processing-retry',
        documentId,
        'FAILURE',
        { reason: 'INVALID_DOCUMENT_STATUS' },
        context,
      );
      throw new ConflictException({
        code: 'DOCUMENT_NOT_RETRYABLE',
        message: 'Only failed documents can be reprocessed.',
      });
    }
    if (result.kind === 'LIMIT_REACHED') {
      await this.writeAudit(
        'document.processing-retry',
        documentId,
        'FAILURE',
        { reason: 'MANUAL_RETRY_LIMIT_REACHED' },
        context,
      );
      throw new ConflictException({
        code: 'DOCUMENT_RETRY_LIMIT_REACHED',
        message: 'The maximum number of manual processing retries has been reached.',
      });
    }

    try {
      await this.queue.enqueue({
        documentId,
        processingJobId: result.processingJobId,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'The queue is unavailable.';
      const failedDocument = await this.documents.markQueueFailed(
        documentId,
        result.processingJobId,
        message,
      );
      await this.writeAudit(
        'document.processing-retry',
        documentId,
        'FAILURE',
        { reason: 'QUEUE_UNAVAILABLE' },
        context,
      );
      return failedDocument;
    }

    await this.writeAudit(
      'document.processing-retry',
      documentId,
      'SUCCESS',
      { processingJobId: result.processingJobId },
      context,
    );
    return result.document;
  }

  public async deleteRecoverable(
    documentId: string,
    context: DocumentActionContext,
  ): Promise<void> {
    const existing = await this.documents.findAccessById(documentId);
    if (existing === null) {
      await this.writeAudit(
        'document.delete',
        documentId,
        'FAILURE',
        { reason: 'DOCUMENT_NOT_FOUND' },
        context,
      );
      throw new NotFoundException('The document does not exist.');
    }
    if (!['DRAFT', 'FAILED'].includes(existing.status)) {
      await this.writeAudit(
        'document.delete',
        documentId,
        'FAILURE',
        { reason: 'INVALID_DOCUMENT_STATUS' },
        context,
      );
      throw new ConflictException({
        code: 'DOCUMENT_NOT_DELETABLE',
        message: 'Only draft or failed documents can be deleted.',
      });
    }

    await this.writeAudit(
      'document.delete-request',
      documentId,
      'SUCCESS',
      { patientId: existing.patientId, status: existing.status },
      context,
    );
    const result = await this.documents.deleteRecoverable(documentId);
    if (result.kind === 'NOT_FOUND') {
      await this.writeAudit(
        'document.delete',
        documentId,
        'FAILURE',
        { reason: 'DOCUMENT_NOT_FOUND' },
        context,
      );
      throw new NotFoundException('The document does not exist.');
    }
    if (result.kind === 'INVALID_STATUS') {
      await this.writeAudit(
        'document.delete',
        documentId,
        'FAILURE',
        { reason: 'CONCURRENT_STATUS_CHANGE' },
        context,
      );
      throw new ConflictException({
        code: 'DOCUMENT_DELETION_CONFLICT',
        message: 'The document status changed before it could be deleted.',
      });
    }

    try {
      await Promise.all(result.objectKeys.map((objectKey) => this.storage.delete(objectKey)));
    } catch (error: unknown) {
      await this.writeAudit(
        'document.delete',
        documentId,
        'FAILURE',
        { reason: 'STORAGE_CLEANUP_FAILED' },
        context,
      );
      throw error;
    }
    await this.writeAudit(
      'document.delete',
      documentId,
      'SUCCESS',
      { patientId: existing.patientId, status: existing.status },
      context,
    );
  }

  public async create(
    input: CreateDocumentInput,
    file: UploadedPdf | undefined,
    context: DocumentActionContext,
  ): Promise<ManagedDocument> {
    this.validateFile(file);
    const normalized = this.normalizeInput(input);
    const patient = await this.documents.findActivePatientById(input.patientId);
    if (patient === null) {
      await this.writeAudit(
        'document.create',
        null,
        'FAILURE',
        { reason: 'PATIENT_NOT_FOUND' },
        context,
      );
      throw new NotFoundException({
        code: 'ACTIVE_PATIENT_NOT_FOUND',
        message: 'The selected active patient does not exist.',
      });
    }

    const documentId = randomUUID();
    const objectKey = `patients/${patient.id}/documents/${documentId}/original.pdf`;
    await this.storage.store({
      body: file.buffer,
      contentType: 'application/pdf',
      key: objectKey,
    });

    let result;
    try {
      result = await this.documents.create({
        ...normalized,
        fileSizeBytes: file.size,
        id: documentId,
        originalObjectKey: objectKey,
        patientId: patient.id,
        queueForProcessing: input.action === UploadAction.Process,
        replacesId: input.replacesId ?? null,
        uploadedById: context.actorId,
      });
    } catch (error: unknown) {
      await this.storage.delete(objectKey).catch(() => undefined);
      throw error;
    }

    if (result.kind === 'INVALID_REPLACEMENT') {
      await this.storage.delete(objectKey).catch(() => undefined);
      await this.writeAudit(
        'document.create',
        documentId,
        'FAILURE',
        { reason: 'INVALID_REPLACEMENT' },
        context,
      );
      throw new ConflictException({
        code: 'INVALID_REPLACEMENT',
        message: 'The selected document is no longer available as a replacement candidate.',
      });
    }

    if (result.processingJobId !== null) {
      try {
        await this.queue.enqueue({ documentId, processingJobId: result.processingJobId });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'The queue is unavailable.';
        const failedDocument = await this.documents.markQueueFailed(
          documentId,
          result.processingJobId,
          message,
        );
        await this.writeAudit(
          'document.processing-queue',
          documentId,
          'FAILURE',
          { reason: 'QUEUE_UNAVAILABLE' },
          context,
        );
        return failedDocument;
      }
    }

    await this.writeAudit(
      input.action === UploadAction.Draft ? 'document.draft-create' : 'document.processing-request',
      documentId,
      'SUCCESS',
      {
        patientId: patient.id,
        ...(input.replacesId === undefined ? {} : { replacesId: input.replacesId }),
        type: input.type,
      },
      context,
    );
    return result.document;
  }

  private validateFile(file: UploadedPdf | undefined): asserts file is UploadedPdf {
    if (file === undefined) {
      throw new BadRequestException({ code: 'PDF_REQUIRED', message: 'Select a PDF file.' });
    }
    if (file.size <= 0 || file.size > maximumPdfSizeBytes) {
      throw new BadRequestException({
        code: 'INVALID_PDF_SIZE',
        message: 'The PDF must be 10 MB or smaller.',
      });
    }
    if (
      file.mimetype !== 'application/pdf' ||
      !file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))
    ) {
      throw new BadRequestException({
        code: 'INVALID_PDF_TYPE',
        message: 'The uploaded file is not a valid PDF.',
      });
    }
  }

  private canReadMetadata(document: ManagedDocument, principal: AuthenticatedPrincipal): boolean {
    return (
      hasPermission(principal.role, Permission.DocumentMetadataReadAll) ||
      (hasPermission(principal.role, Permission.DocumentReadOwn) &&
        document.patient.id === principal.id &&
        ['ANNULLED', 'PUBLISHED'].includes(document.status))
    );
  }

  private hideUnpublishedReplacement(document: ManagedDocument): ManagedDocument {
    return document.replacement === null || document.replacement.status === 'PUBLISHED'
      ? document
      : { ...document, replacement: null };
  }

  private async getContentRecord(
    documentId: string,
    principal: AuthenticatedPrincipal,
  ): Promise<DocumentAccessRecord> {
    const document = await this.documents.findAccessById(documentId);
    const operatorAccess =
      hasPermission(principal.role, Permission.DocumentContentReadAll) &&
      document !== null &&
      ['PUBLISHED', 'READY_TO_PUBLISH'].includes(document.status);
    const patientAccess =
      hasPermission(principal.role, Permission.DocumentDownloadOwn) &&
      document?.patientId === principal.id &&
      document.status === 'PUBLISHED';
    if (document === null || (!operatorAccess && !patientAccess)) {
      throw new NotFoundException('The document does not exist.');
    }
    return document;
  }

  private getProtectedPassword(document: DocumentAccessRecord): ProtectedPassword {
    if (
      document.passwordAuthTag === null ||
      document.passwordCiphertext === null ||
      document.passwordInitialization === null
    ) {
      throw new ConflictException({
        code: 'DOCUMENT_PASSWORD_UNAVAILABLE',
        message: 'The document password is not available.',
      });
    }
    return {
      authTag: document.passwordAuthTag,
      ciphertext: document.passwordCiphertext,
      initialization: document.passwordInitialization,
    };
  }

  private async getPatientContentRecord(
    documentId: string,
    principal: AuthenticatedPrincipal,
  ): Promise<DocumentAccessRecord> {
    const document = await this.documents.findAccessById(documentId);
    if (
      document === null ||
      !hasPermission(principal.role, Permission.DocumentDownloadOwn) ||
      document.patientId !== principal.id ||
      document.status !== 'PUBLISHED'
    ) {
      throw new NotFoundException('The document does not exist.');
    }
    return document;
  }

  private normalizeInput(input: CreateDocumentInput) {
    const documentDate = new Date(`${input.documentDate}T00:00:00.000Z`);
    if (Number.isNaN(documentDate.getTime()) || documentDate > new Date()) {
      throw new BadRequestException({
        code: 'INVALID_DOCUMENT_DATE',
        message: 'Document date must be a valid date that is not in the future.',
      });
    }

    const title = input.title.trim().replace(/\s+/g, ' ');
    if (title.length < 2) {
      throw new BadRequestException({
        code: 'DOCUMENT_TITLE_REQUIRED',
        message: 'Document title is required.',
      });
    }
    const examType = input.examType?.trim().replace(/\s+/g, ' ') ?? '';
    const procedureName = input.procedureName?.trim().replace(/\s+/g, ' ') ?? '';
    if (input.type === DocumentType.LabResult && examType.length < 2) {
      throw new BadRequestException({
        code: 'EXAM_TYPE_REQUIRED',
        message: 'Exam type is required.',
      });
    }
    if (input.type === DocumentType.InformedConsent && procedureName.length < 2) {
      throw new BadRequestException({
        code: 'PROCEDURE_NAME_REQUIRED',
        message: 'Procedure name is required.',
      });
    }

    const description = input.description?.trim() ?? '';
    return {
      description: description.length === 0 ? null : description,
      documentDate,
      examType: input.type === DocumentType.LabResult ? examType : null,
      procedureName: input.type === DocumentType.InformedConsent ? procedureName : null,
      title,
      type: input.type,
    };
  }

  private writeAudit(
    action: string,
    resourceId: string | null,
    result: 'FAILURE' | 'SUCCESS',
    metadata: Record<string, string>,
    context: DocumentActionContext,
  ): Promise<void> {
    return this.audit.write({
      action,
      actorId: context.actorId,
      ipAddress: context.ipAddress,
      metadata,
      resourceId,
      resourceType: 'document',
      result,
      userAgent: context.userAgent,
    });
  }

  private writeAccessAudit(
    action: string,
    document: DocumentAccessRecord,
    actorId: string,
    context: RequestContext,
  ): Promise<void> {
    return this.audit.write({
      action,
      actorId,
      ipAddress: context.ipAddress,
      metadata: { patientId: document.patientId },
      resourceId: document.id,
      resourceType: 'document',
      result: 'SUCCESS',
      userAgent: context.userAgent,
    });
  }
}
