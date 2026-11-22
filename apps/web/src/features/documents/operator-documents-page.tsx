import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  Files,
  LoaderCircle,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { ApiError } from '@/api/client';
import {
  deleteDocument,
  listDocuments,
  retryDocument,
  type DocumentSummary,
  type DocumentType,
} from '@/api/documents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DocumentDetailPanel } from './document-detail-panel';
import { DocumentUploadWizard } from './document-upload-wizard';
import { DocumentStatusBadge, documentTypeLabel, formatDocumentDate } from './document-ui';

export function OperatorDocumentsPage() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<DocumentSummary['status'] | ''>('');
  const [type, setType] = useState<DocumentType | ''>('');
  const [selectedDocument, setSelectedDocument] = useState<DocumentSummary | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [search]);

  const documentsQuery = useQuery({
    queryFn: () =>
      listDocuments({
        page,
        ...(debouncedSearch === '' ? {} : { search: debouncedSearch }),
        ...(status === '' ? {} : { status }),
        ...(type === '' ? {} : { type }),
      }),
    queryKey: ['documents', 'operator', page, debouncedSearch, status, type],
    refetchInterval: (query) =>
      query.state.data?.items.some((item) => ['PENDING', 'PROCESSING'].includes(item.status)) ===
      true
        ? 5_000
        : false,
  });
  const retryMutation = useMutation({
    mutationFn: (document: DocumentSummary) => retryDocument(document.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (document: DocumentSummary) => deleteDocument(document.id),
    onSuccess: async (_, document) => {
      if (selectedDocument?.id === document.id) setSelectedDocument(null);
      await queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
  const actionError = retryMutation.error ?? deleteMutation.error ?? null;
  const actionErrorMessage =
    actionError instanceof ApiError
      ? actionError.message
      : actionError === null
        ? null
        : 'The document action could not be completed.';

  if (uploading) {
    return (
      <div className="px-4 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <Button
            className="mb-5 gap-2"
            onClick={() => {
              setUploading(false);
              void queryClient.invalidateQueries({ queryKey: ['documents'] });
            }}
            variant="ghost"
          >
            <ArrowLeft className="size-4" /> Back to documents
          </Button>
          <DocumentUploadWizard />
        </div>
      </div>
    );
  }

  const documents = documentsQuery.data?.items ?? [];

  return (
    <div className="px-4 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-teal-700">
              <Files className="size-4" /> Operator workspace
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Documents</h1>
            <p className="mt-2 text-sm text-slate-600">
              Review processing results and publish documents to patients.
            </p>
          </div>
          <Button
            className="gap-2"
            onClick={() => {
              setUploading(true);
            }}
          >
            <FilePlus2 className="size-4" /> Upload document
          </Button>
        </header>

        <section className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[1fr_12rem_12rem]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
                placeholder="Search title, patient, or clinical code"
                value={search}
              />
            </div>
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
              onChange={(event) => {
                setStatus(event.target.value as DocumentSummary['status'] | '');
                setPage(1);
              }}
              value={status}
            >
              <option value="">All statuses</option>
              <option value="READY_TO_PUBLISH">Ready to publish</option>
              <option value="PUBLISHED">Published</option>
              <option value="PROCESSING">Processing</option>
              <option value="PENDING">Queued</option>
              <option value="DRAFT">Draft</option>
              <option value="FAILED">Failed</option>
              <option value="ANNULLED">Annulled</option>
            </select>
            <select
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
          </div>

          {actionErrorMessage === null ? null : (
            <div
              className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {actionErrorMessage}
            </div>
          )}

          {documentsQuery.isPending ? (
            <LoadingRows />
          ) : documentsQuery.isError ? (
            <Message
              title="Documents could not be loaded"
              description="Check the API connection and try again."
            />
          ) : documents.length === 0 ? (
            <Message
              title="No documents found"
              description="Upload a document or change the current filters."
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Document</th>
                      <th className="px-5 py-3 font-semibold">Patient</th>
                      <th className="px-5 py-3 font-semibold">Date</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {documents.map((document) => (
                      <tr className="hover:bg-slate-50" key={document.id}>
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-950">{document.title}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {documentTypeLabel(document.type)}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-slate-900">{document.patient.fullName}</div>
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
                        <td className="px-5 py-4 text-right">
                          <DocumentActions
                            deleting={
                              deleteMutation.isPending &&
                              deleteMutation.variables.id === document.id
                            }
                            document={document}
                            onDelete={() => {
                              if (
                                window.confirm(
                                  `Permanently delete “${document.title}”? This action cannot be undone.`,
                                )
                              ) {
                                deleteMutation.mutate(document);
                              }
                            }}
                            onOpen={() => {
                              setSelectedDocument(document);
                            }}
                            onRetry={() => {
                              retryMutation.mutate(document);
                            }}
                            retrying={
                              retryMutation.isPending && retryMutation.variables.id === document.id
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-slate-200 md:hidden">
                {documents.map((document) => (
                  <article className="p-5" key={document.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold text-slate-950">{document.title}</h2>
                        <p className="mt-1 text-sm text-slate-500">
                          {document.patient.fullName} · {formatDocumentDate(document.documentDate)}
                        </p>
                      </div>
                      <DocumentStatusBadge status={document.status} />
                    </div>
                    <DocumentActions
                      className="mt-4"
                      deleting={
                        deleteMutation.isPending && deleteMutation.variables.id === document.id
                      }
                      document={document}
                      onDelete={() => {
                        if (
                          window.confirm(
                            `Permanently delete “${document.title}”? This action cannot be undone.`,
                          )
                        ) {
                          deleteMutation.mutate(document);
                        }
                      }}
                      onOpen={() => {
                        setSelectedDocument(document);
                      }}
                      onRetry={() => {
                        retryMutation.mutate(document);
                      }}
                      retrying={
                        retryMutation.isPending && retryMutation.variables.id === document.id
                      }
                    />
                  </article>
                ))}
              </div>
            </>
          )}

          <Pagination
            page={documentsQuery.data?.page ?? page}
            totalPages={documentsQuery.data?.totalPages ?? 0}
            onPage={setPage}
          />
        </section>
      </div>

      {selectedDocument === null ? null : (
        <DocumentDetailPanel
          document={selectedDocument}
          mode="operator"
          onClose={() => {
            setSelectedDocument(null);
          }}
          onPublished={setSelectedDocument}
        />
      )}
    </div>
  );
}

function DocumentActions({
  className = '',
  deleting,
  document,
  onDelete,
  onOpen,
  onRetry,
  retrying,
}: {
  className?: string;
  deleting: boolean;
  document: DocumentSummary;
  onDelete: () => void;
  onOpen: () => void;
  onRetry: () => void;
  retrying: boolean;
}) {
  const canDelete = ['DRAFT', 'FAILED'].includes(document.status);
  const canOpen = ['PUBLISHED', 'READY_TO_PUBLISH'].includes(document.status);
  if (!canDelete && !canOpen) return <span className="text-xs text-slate-400">Unavailable</span>;

  return (
    <div className={`flex flex-wrap justify-end gap-2 ${className}`}>
      {document.status === 'FAILED' ? (
        <Button disabled={retrying || deleting} onClick={onRetry} size="sm" variant="outline">
          {retrying ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <RotateCcw aria-hidden="true" className="size-4" />
          )}
          Retry
        </Button>
      ) : null}
      {canDelete ? (
        <Button disabled={deleting || retrying} onClick={onDelete} size="sm" variant="destructive">
          {deleting ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Trash2 aria-hidden="true" className="size-4" />
          )}
          Delete
        </Button>
      ) : null}
      {canOpen ? (
        <Button onClick={onOpen} size="sm" variant="outline">
          {document.status === 'READY_TO_PUBLISH' ? 'Review' : 'View'}
        </Button>
      ) : null}
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-slate-500">
      <LoaderCircle className="size-5 animate-spin" /> Loading documents…
    </div>
  );
}

function Message({ description, title }: { description: string; title: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <Files className="mx-auto size-8 text-slate-400" />
      <h2 className="mt-3 font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
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
