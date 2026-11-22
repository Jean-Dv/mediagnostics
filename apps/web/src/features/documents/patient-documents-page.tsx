import { useQuery } from '@tanstack/react-query';
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  FileText,
  Files,
  LoaderCircle,
  Search,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { listDocuments, type DocumentSummary, type DocumentType } from '@/api/documents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DocumentDetailPanel } from './document-detail-panel';
import { DocumentStatusBadge, documentTypeLabel, formatDocumentDate } from './document-ui';

export function PatientDocumentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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
        ...(type === '' ? {} : { type }),
      }),
    queryKey: ['documents', 'patient', page, debouncedSearch, type],
  });
  const documents = documentsQuery.data?.items ?? [];

  return (
    <div className="px-4 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header>
          <div className="flex items-center gap-2 text-sm font-medium text-teal-700">
            <Files className="size-4" /> Patient workspace
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            My documents
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Review published documents and the history of records that were annulled.
          </p>
        </header>

        <div className="mt-7 grid gap-3 sm:grid-cols-[1fr_14rem]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              placeholder="Search my documents"
              value={search}
            />
          </div>
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

        {documentsQuery.isPending ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
            <LoaderCircle className="size-5 animate-spin" /> Loading your documents…
          </div>
        ) : documentsQuery.isError ? (
          <EmptyState
            description="Check the API connection and try again."
            title="Documents could not be loaded"
          />
        ) : documents.length === 0 ? (
          <EmptyState
            description="Published laboratory results and consents will appear here."
            title="No documents found"
          />
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {documents.map((document) =>
              document.status === 'ANNULLED' ? (
                <article
                  className="rounded-2xl border border-red-200 bg-red-50/40 p-5 shadow-sm"
                  key={document.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-red-100 text-red-700">
                      <Ban aria-hidden="true" className="size-5" />
                    </div>
                    <DocumentStatusBadge status={document.status} />
                  </div>
                  <h2 className="mt-5 line-clamp-2 font-semibold text-slate-950">
                    {document.title}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">{documentTypeLabel(document.type)}</p>
                  <div className="mt-4 rounded-lg border border-red-100 bg-white/80 px-3 py-2.5">
                    <div className="text-xs font-semibold uppercase tracking-wide text-red-700">
                      Annulment reason
                    </div>
                    <p className="mt-1 text-sm leading-5 text-slate-700">
                      {document.annulmentReason ?? 'No reason is available.'}
                    </p>
                  </div>
                  {document.replacement === null ? null : (
                    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                        Replaced by
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {document.replacement.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        Published document · {formatDocumentDate(document.replacement.documentDate)}
                      </p>
                    </div>
                  )}
                  <div className="mt-5 border-t border-red-100 pt-4 text-sm text-slate-600">
                    {formatDocumentDate(document.documentDate)} · Access revoked
                  </div>
                </article>
              ) : (
                <button
                  className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
                  key={document.id}
                  onClick={() => {
                    setSelectedDocument(document);
                  }}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                      <FileText className="size-5" />
                    </div>
                    <DocumentStatusBadge status={document.status} />
                  </div>
                  <h2 className="mt-5 line-clamp-2 font-semibold text-slate-950 group-hover:text-teal-800">
                    {document.title}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">{documentTypeLabel(document.type)}</p>
                  <div className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-600">
                    {formatDocumentDate(document.documentDate)}
                    {document.pageCount === null
                      ? null
                      : ` · ${document.pageCount.toString()} pages`}
                  </div>
                </button>
              ),
            )}
          </div>
        )}

        {(documentsQuery.data?.totalPages ?? 0) > 1 ? (
          <div className="mt-7 flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Page {documentsQuery.data?.page} of {documentsQuery.data?.totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                disabled={page <= 1}
                onClick={() => {
                  setPage((current) => current - 1);
                }}
                size="sm"
                variant="outline"
              >
                <ChevronLeft className="size-4" /> Previous
              </Button>
              <Button
                disabled={page >= (documentsQuery.data?.totalPages ?? 0)}
                onClick={() => {
                  setPage((current) => current + 1);
                }}
                size="sm"
                variant="outline"
              >
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {selectedDocument === null ? null : (
        <DocumentDetailPanel
          document={selectedDocument}
          mode="patient"
          onClose={() => {
            setSelectedDocument(null);
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ description, title }: { description: string; title: string }) {
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
      <Files className="mx-auto size-9 text-slate-400" />
      <h2 className="mt-4 font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </section>
  );
}
