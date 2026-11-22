import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Files,
  LoaderCircle,
  Search,
} from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';

import { ApiError } from '@/api/client';
import {
  annulDocument,
  listDocuments,
  type DocumentSummary,
  type DocumentType,
} from '@/api/documents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { DocumentStatusBadge, documentTypeLabel, formatDocumentDate } from './document-ui';

export function AdminDocumentsPage() {
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DocumentSummary['status'] | ''>('');
  const [type, setType] = useState<DocumentType | ''>('');
  const [documentToAnnul, setDocumentToAnnul] = useState<DocumentSummary | null>(null);
  const documentsQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () =>
      listDocuments({
        page,
        ...(search === '' ? {} : { search }),
        ...(status === '' ? {} : { status }),
        ...(type === '' ? {} : { type }),
      }),
    queryKey: ['documents', 'admin', { page, search, status, type }],
  });
  const submitSearch = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchDraft.trim());
    setPage(1);
  };

  return (
    <div className="mx-auto min-h-screen max-w-[1600px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <header>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-teal-700">
          <Files aria-hidden="true" className="size-4" /> Document governance
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Documents</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Review clinical document metadata and annul published records when necessary.
        </p>
      </header>

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <form
          className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[minmax(240px,1fr)_180px_180px_auto]"
          onSubmit={submitSearch}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              aria-label="Search documents"
              className="pl-9"
              onChange={(event) => {
                setSearchDraft(event.target.value);
              }}
              placeholder="Search title, patient, or clinical code"
              value={searchDraft}
            />
          </div>
          <select
            aria-label="Filter by status"
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            onChange={(event) => {
              setStatus(event.target.value as DocumentSummary['status'] | '');
              setPage(1);
            }}
            value={status}
          >
            <option value="">All statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="ANNULLED">Annulled</option>
            <option value="READY_TO_PUBLISH">Ready to publish</option>
            <option value="PROCESSING">Processing</option>
            <option value="PENDING">Queued</option>
            <option value="FAILED">Failed</option>
            <option value="DRAFT">Draft</option>
          </select>
          <select
            aria-label="Filter by document type"
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            onChange={(event) => {
              setType(event.target.value as DocumentType | '');
              setPage(1);
            }}
            value={type}
          >
            <option value="">All document types</option>
            <option value="LAB_RESULT">Laboratory results</option>
            <option value="INFORMED_CONSENT">Informed consents</option>
          </select>
          <Button className="gap-2" type="submit" variant="outline">
            <Search aria-hidden="true" className="size-4" /> Search
          </Button>
        </form>

        {documentsQuery.isError ? (
          <div className="m-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <CircleAlert className="size-5" /> Documents could not be loaded.
          </div>
        ) : documentsQuery.isPending ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <LoaderCircle className="size-5 animate-spin" /> Loading documents…
          </div>
        ) : documentsQuery.data.items.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">No documents found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Document</th>
                  <th className="px-5 py-3 font-semibold">Patient</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Annulment reason</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {documentsQuery.data.items.map((document) => (
                  <tr className="hover:bg-slate-50" key={document.id}>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-950">{document.title}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {documentTypeLabel(document.type)}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div>{document.patient.fullName}</div>
                      <code className="text-xs text-slate-500">
                        {document.patient.clinicalCode}
                      </code>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatDocumentDate(document.documentDate)}
                    </td>
                    <td className="px-5 py-4">
                      <DocumentStatusBadge status={document.status} />
                    </td>
                    <td className="max-w-xs px-5 py-4 text-slate-600">
                      {document.annulmentReason ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {document.status === 'PUBLISHED' ? (
                        <Button
                          className="gap-2"
                          onClick={() => {
                            setDocumentToAnnul(document);
                          }}
                          size="sm"
                          variant="destructive"
                        >
                          <Ban aria-hidden="true" className="size-4" /> Annul
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">Unavailable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          onPage={setPage}
          page={documentsQuery.data?.page ?? page}
          totalPages={documentsQuery.data?.totalPages ?? 0}
        />
      </section>

      {documentToAnnul === null ? null : (
        <AnnulDocumentDialog
          document={documentToAnnul}
          onClose={() => {
            setDocumentToAnnul(null);
          }}
        />
      )}
    </div>
  );
}

function AnnulDocumentDialog({
  document,
  onClose,
}: {
  document: DocumentSummary;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const normalizedReason = reason.trim().replace(/\s+/g, ' ');
  const mutation = useMutation({
    mutationFn: () => annulDocument(document.id, normalizedReason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['documents'] });
      onClose();
    },
  });
  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error === null
        ? null
        : 'The document could not be annulled.';

  return (
    <Modal
      description="The patient will immediately lose preview and download access. The files and audit history will be preserved."
      onClose={onClose}
      title="Annul published document?"
    >
      <div className="rounded-lg bg-slate-100 px-4 py-3">
        <div className="font-medium text-slate-950">{document.title}</div>
        <div className="mt-1 text-sm text-slate-600">{document.patient.fullName}</div>
      </div>
      <label className="mt-5 block text-sm font-medium text-slate-800" htmlFor="annulment-reason">
        Annulment reason
      </label>
      <textarea
        className="mt-2 min-h-32 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
        id="annulment-reason"
        maxLength={500}
        onChange={(event) => {
          setReason(event.target.value);
        }}
        placeholder="Explain why this published document must be annulled."
        value={reason}
      />
      <div className="mt-1 flex justify-between text-xs text-slate-500">
        <span>10–500 characters required</span>
        <span>{normalizedReason.length}/500</span>
      </div>
      {errorMessage === null ? null : (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Button disabled={mutation.isPending} onClick={onClose} type="button" variant="outline">
          Cancel
        </Button>
        <Button
          className="gap-2"
          disabled={
            mutation.isPending || normalizedReason.length < 10 || normalizedReason.length > 500
          }
          onClick={() => {
            mutation.mutate();
          }}
          type="button"
          variant="destructive"
        >
          {mutation.isPending ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Ban aria-hidden="true" className="size-4" />
          )}
          Annul document
        </Button>
      </div>
    </Modal>
  );
}

function Pagination({
  onPage,
  page,
  totalPages,
}: {
  onPage: (page: number) => void;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
      <span className="text-sm text-slate-500">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Button
          disabled={page <= 1}
          onClick={() => {
            onPage(page - 1);
          }}
          size="sm"
          variant="outline"
        >
          <ChevronLeft className="size-4" /> Previous
        </Button>
        <Button
          disabled={page >= totalPages}
          onClick={() => {
            onPage(page + 1);
          }}
          size="sm"
          variant="outline"
        >
          Next <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
