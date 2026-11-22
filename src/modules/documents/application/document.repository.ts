import type { DocumentStatus, DocumentType } from '../domain/document.js';

export const DOCUMENT_REPOSITORY = Symbol('DOCUMENT_REPOSITORY');

export interface PatientOption {
  clinicalCode: string;
  email: string;
  fullName: string;
  id: string;
}

export interface ManagedDocument {
  annulledAt: Date | null;
  annulmentReason: string | null;
  createdAt: Date;
  description: string | null;
  documentDate: Date;
  examType: string | null;
  fileSizeBytes: number;
  id: string;
  pageCount: number | null;
  patient: PatientOption;
  procedureName: string | null;
  publishedAt: Date | null;
  replacement: ReplacementReference | null;
  status: DocumentStatus;
  title: string;
  type: DocumentType;
}

export interface ReplacementReference {
  documentDate: Date;
  id: string;
  status: DocumentStatus;
  title: string;
}

export interface DocumentPage {
  items: ManagedDocument[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListDocumentsInput {
  page: number;
  pageSize: number;
  patientId?: string;
  patientHistoryOnly?: boolean;
  search?: string;
  status?: DocumentStatus;
  type?: DocumentType;
}

export interface DocumentAccessRecord {
  id: string;
  passwordAuthTag: string | null;
  passwordCiphertext: string | null;
  passwordInitialization: string | null;
  patientId: string;
  previewObjectKey: string | null;
  protectedObjectKey: string | null;
  status: DocumentStatus;
  title: string;
}

export interface CreateDocumentRecord {
  description: string | null;
  documentDate: Date;
  examType: string | null;
  fileSizeBytes: number;
  id: string;
  originalObjectKey: string;
  patientId: string;
  procedureName: string | null;
  queueForProcessing: boolean;
  replacesId?: string | null;
  title: string;
  type: DocumentType;
  uploadedById: string;
}

export interface CreateDocumentResult {
  kind: 'CREATED';
  document: ManagedDocument;
  processingJobId: string | null;
}

export type CreateDocumentOutcome = CreateDocumentResult | { kind: 'INVALID_REPLACEMENT' };

export type RetryDocumentResult =
  | { kind: 'CREATED'; document: ManagedDocument; processingJobId: string }
  | { kind: 'INVALID_STATUS' }
  | { kind: 'LIMIT_REACHED' }
  | { kind: 'NOT_FOUND' };

export type DeleteDocumentResult =
  { kind: 'DELETED'; objectKeys: string[] } | { kind: 'INVALID_STATUS' } | { kind: 'NOT_FOUND' };

export interface DocumentRepository {
  annul(
    documentId: string,
    annulledById: string,
    annulmentReason: string,
    annulledAt: Date,
  ): Promise<ManagedDocument | null>;
  create(input: CreateDocumentRecord): Promise<CreateDocumentOutcome>;
  deleteRecoverable(documentId: string): Promise<DeleteDocumentResult>;
  findAccessById(documentId: string): Promise<DocumentAccessRecord | null>;
  findActivePatientById(patientId: string): Promise<PatientOption | null>;
  findById(documentId: string): Promise<ManagedDocument | null>;
  findReplacementCandidates(patientId: string, type: DocumentType): Promise<ManagedDocument[]>;
  list(input: ListDocumentsInput): Promise<DocumentPage>;
  markQueueFailed(
    documentId: string,
    processingJobId: string,
    message: string,
  ): Promise<ManagedDocument>;
  publish(documentId: string, publishedAt: Date): Promise<ManagedDocument | null>;
  retry(documentId: string, maximumManualRetries: number): Promise<RetryDocumentResult>;
  searchActivePatients(search: string): Promise<PatientOption[]>;
}
