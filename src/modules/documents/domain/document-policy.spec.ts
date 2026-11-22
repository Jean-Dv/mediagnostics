import { describe, expect, it } from 'vitest';

import {
  canDeleteDocument,
  canEditDocumentMetadata,
  canPatientAccessDocument,
  canTransitionDocument,
  DocumentStatus,
} from './document-policy.js';

describe('document policy', () => {
  it('enforces the processing and publication lifecycle', () => {
    expect(canTransitionDocument(DocumentStatus.Draft, DocumentStatus.Pending)).toBe(true);
    expect(canTransitionDocument(DocumentStatus.Processing, DocumentStatus.ReadyToPublish)).toBe(
      true,
    );
    expect(canTransitionDocument(DocumentStatus.Published, DocumentStatus.Draft)).toBe(false);
  });

  it('makes published documents immutable', () => {
    expect(canEditDocumentMetadata(DocumentStatus.Published)).toBe(false);
    expect(canDeleteDocument(DocumentStatus.Published)).toBe(false);
    expect(canTransitionDocument(DocumentStatus.Published, DocumentStatus.Annulled)).toBe(true);
  });

  it('allows deleting only drafts and failed documents', () => {
    expect(canDeleteDocument(DocumentStatus.Draft)).toBe(true);
    expect(canDeleteDocument(DocumentStatus.Failed)).toBe(true);
    expect(canDeleteDocument(DocumentStatus.ReadyToPublish)).toBe(false);
  });

  it('only exposes active published documents to patients', () => {
    expect(canPatientAccessDocument(DocumentStatus.Published)).toBe(true);
    expect(canPatientAccessDocument(DocumentStatus.Annulled)).toBe(false);
    expect(canPatientAccessDocument(DocumentStatus.ReadyToPublish)).toBe(false);
  });

  it('allows retrying a failed processing job', () => {
    expect(canTransitionDocument(DocumentStatus.Failed, DocumentStatus.Pending)).toBe(true);
  });
});
