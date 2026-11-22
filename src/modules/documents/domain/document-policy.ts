export enum DocumentStatus {
  Draft = 'DRAFT',
  Pending = 'PENDING',
  Processing = 'PROCESSING',
  ReadyToPublish = 'READY_TO_PUBLISH',
  Published = 'PUBLISHED',
  Annulled = 'ANNULLED',
  Failed = 'FAILED',
}

const allowedTransitions: Readonly<Record<DocumentStatus, ReadonlySet<DocumentStatus>>> = {
  [DocumentStatus.Draft]: new Set([DocumentStatus.Pending]),
  [DocumentStatus.Pending]: new Set([DocumentStatus.Processing]),
  [DocumentStatus.Processing]: new Set([DocumentStatus.ReadyToPublish, DocumentStatus.Failed]),
  [DocumentStatus.ReadyToPublish]: new Set([DocumentStatus.Published]),
  [DocumentStatus.Published]: new Set([DocumentStatus.Annulled]),
  [DocumentStatus.Annulled]: new Set(),
  [DocumentStatus.Failed]: new Set([DocumentStatus.Pending]),
};

export function canTransitionDocument(
  currentStatus: DocumentStatus,
  nextStatus: DocumentStatus,
): boolean {
  return allowedTransitions[currentStatus].has(nextStatus);
}

export function canEditDocumentMetadata(status: DocumentStatus): boolean {
  return status === DocumentStatus.Draft || status === DocumentStatus.ReadyToPublish;
}

export function canDeleteDocument(status: DocumentStatus): boolean {
  return status === DocumentStatus.Draft || status === DocumentStatus.Failed;
}

export function canPatientAccessDocument(status: DocumentStatus): boolean {
  return status === DocumentStatus.Published;
}
