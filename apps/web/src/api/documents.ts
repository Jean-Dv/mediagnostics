import { apiBlob, apiRequest } from './client';

export type DocumentType = 'INFORMED_CONSENT' | 'LAB_RESULT';
export type UploadAction = 'DRAFT' | 'PROCESS';

export interface PatientOption {
  clinicalCode: string;
  email: string;
  fullName: string;
  id: string;
}

export interface DocumentSummary {
  annulledAt: string | null;
  annulmentReason: string | null;
  createdAt: string;
  description: string | null;
  documentDate: string;
  examType: string | null;
  fileSizeBytes: number;
  id: string;
  pageCount: number | null;
  patient: PatientOption;
  procedureName: string | null;
  publishedAt: string | null;
  replacement: {
    documentDate: string;
    id: string;
    status: DocumentSummary['status'];
    title: string;
  } | null;
  status:
    'ANNULLED' | 'DRAFT' | 'FAILED' | 'PENDING' | 'PROCESSING' | 'PUBLISHED' | 'READY_TO_PUBLISH';
  title: string;
  type: DocumentType;
}

export interface DocumentPage {
  items: DocumentSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListDocumentsInput {
  page: number;
  search?: string;
  status?: DocumentSummary['status'];
  type?: DocumentType;
}

export function listDocuments(input: ListDocumentsInput): Promise<DocumentPage> {
  const parameters = new URLSearchParams({ page: input.page.toString(), pageSize: '20' });
  if (input.search !== undefined && input.search.trim().length > 0) {
    parameters.set('search', input.search.trim());
  }
  if (input.status !== undefined) parameters.set('status', input.status);
  if (input.type !== undefined) parameters.set('type', input.type);
  return apiRequest<DocumentPage>(`/api/v1/documents?${parameters.toString()}`);
}

export function getDocument(documentId: string): Promise<DocumentSummary> {
  return apiRequest<DocumentSummary>(`/api/v1/documents/${documentId}`);
}

export function getDocumentPreview(documentId: string): Promise<Blob> {
  return apiBlob(`/api/v1/documents/${documentId}/preview`, 'image/webp');
}

export function downloadDocument(documentId: string): Promise<Blob> {
  return apiBlob(`/api/v1/documents/${documentId}/download`, 'application/pdf');
}

export function revealDocumentPassword(documentId: string): Promise<string> {
  return apiRequest<{ password: string }>(`/api/v1/documents/${documentId}/password`).then(
    ({ password }) => password,
  );
}

export function recordDocumentPasswordCopy(documentId: string): Promise<undefined> {
  return apiRequest<undefined>(`/api/v1/documents/${documentId}/password-copy`, {
    method: 'POST',
  });
}

export function publishDocument(documentId: string): Promise<DocumentSummary> {
  return apiRequest<DocumentSummary>(`/api/v1/documents/${documentId}/publish`, {
    method: 'POST',
  });
}

export function annulDocument(documentId: string, reason: string): Promise<DocumentSummary> {
  return apiRequest<DocumentSummary>(`/api/v1/documents/${documentId}/annul`, {
    body: { reason },
    method: 'POST',
  });
}

export function retryDocument(documentId: string): Promise<DocumentSummary> {
  return apiRequest<DocumentSummary>(`/api/v1/documents/${documentId}/retry`, {
    method: 'POST',
  });
}

export function deleteDocument(documentId: string): Promise<undefined> {
  return apiRequest<undefined>(`/api/v1/documents/${documentId}`, {
    method: 'DELETE',
  });
}

export function searchPatients(search: string): Promise<PatientOption[]> {
  const parameters = new URLSearchParams({ search });
  return apiRequest<PatientOption[]>(`/api/v1/documents/patients?${parameters.toString()}`);
}

export function getReplacementCandidates(
  patientId: string,
  type: DocumentType,
): Promise<DocumentSummary[]> {
  const parameters = new URLSearchParams({ patientId, type });
  return apiRequest<DocumentSummary[]>(
    `/api/v1/documents/replacement-candidates?${parameters.toString()}`,
  );
}

export function uploadDocument(input: {
  action: UploadAction;
  description: string;
  documentDate: string;
  examType: string;
  file: File;
  patientId: string;
  procedureName: string;
  replacesId?: string;
  title: string;
  type: DocumentType;
}): Promise<DocumentSummary> {
  const body = new FormData();
  body.set('action', input.action);
  body.set('description', input.description);
  body.set('documentDate', input.documentDate);
  body.set('examType', input.examType);
  body.set('file', input.file);
  body.set('patientId', input.patientId);
  body.set('procedureName', input.procedureName);
  if (input.replacesId !== undefined) body.set('replacesId', input.replacesId);
  body.set('title', input.title);
  body.set('type', input.type);

  return apiRequest<DocumentSummary>('/api/v1/documents', { body, method: 'POST' });
}
