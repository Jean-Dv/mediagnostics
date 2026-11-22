export enum DocumentType {
  InformedConsent = 'INFORMED_CONSENT',
  LabResult = 'LAB_RESULT',
}

export enum UploadAction {
  Draft = 'DRAFT',
  Process = 'PROCESS',
}

export type DocumentStatus =
  'ANNULLED' | 'DRAFT' | 'FAILED' | 'PENDING' | 'PROCESSING' | 'PUBLISHED' | 'READY_TO_PUBLISH';
