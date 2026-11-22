import { Badge } from '@/components/ui/badge';
import type { DocumentSummary, DocumentType } from '@/api/documents';

const statusLabels: Record<DocumentSummary['status'], string> = {
  ANNULLED: 'Annulled',
  DRAFT: 'Draft',
  FAILED: 'Failed',
  PENDING: 'Queued',
  PROCESSING: 'Processing',
  PUBLISHED: 'Published',
  READY_TO_PUBLISH: 'Ready to publish',
};

export function DocumentStatusBadge({ status }: { status: DocumentSummary['status'] }) {
  const tone =
    status === 'FAILED' || status === 'ANNULLED'
      ? 'danger'
      : status === 'PUBLISHED' || status === 'READY_TO_PUBLISH'
        ? 'success'
        : status === 'PENDING' || status === 'PROCESSING'
          ? 'teal'
          : 'neutral';
  return <Badge tone={tone}>{statusLabels[status]}</Badge>;
}

export function documentTypeLabel(type: DocumentType): string {
  return type === 'LAB_RESULT' ? 'Laboratory result' : 'Informed consent';
}

export function formatDocumentDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(value));
}
