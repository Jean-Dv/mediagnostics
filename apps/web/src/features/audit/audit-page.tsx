import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  History,
  LoaderCircle,
  Search,
} from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';

import {
  exportAuditEvents,
  listAuditEvents,
  type AuditFilters,
  type AuditRecord,
  type AuditResult,
} from '@/api/audit';
import { ApiError } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
});

const emptyFilters: AuditFilters = {};

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<AuditFilters>(emptyFilters);
  const [filters, setFilters] = useState<AuditFilters>(emptyFilters);
  const auditQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => listAuditEvents(filters, page),
    queryKey: ['audit', filters, page],
  });
  const exportMutation = useMutation({
    mutationFn: () => exportAuditEvents(filters),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = `mediagnostics-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1_000);
    },
  });
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters(normalizeFilters(draft));
    setPage(1);
  };
  const error = auditQuery.error ?? exportMutation.error ?? null;
  const errorMessage =
    error instanceof ApiError
      ? error.message
      : error === null
        ? null
        : 'Audit events could not be loaded.';

  return (
    <div className="mx-auto min-h-screen max-w-[1700px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-teal-700">
            <History aria-hidden="true" className="size-4" /> Security traceability
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Audit</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Review immutable security and clinical document activity.
          </p>
        </div>
        <Button
          className="gap-2"
          disabled={exportMutation.isPending}
          onClick={() => {
            exportMutation.mutate();
          }}
          type="button"
          variant="outline"
        >
          {exportMutation.isPending ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Export CSV
        </Button>
      </header>

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <form
          className="grid gap-3 border-b border-slate-200 p-4 xl:grid-cols-[1fr_1fr_160px_160px_160px_auto]"
          onSubmit={submit}
        >
          <Input
            aria-label="Filter by actor"
            maxLength={100}
            onChange={(event) => {
              setDraft((current) => ({ ...current, actor: event.target.value }));
            }}
            placeholder="Actor name or email"
            value={draft.actor ?? ''}
          />
          <Input
            aria-label="Filter by action"
            maxLength={100}
            onChange={(event) => {
              setDraft((current) => ({ ...current, action: event.target.value }));
            }}
            placeholder="Action, e.g. document.publish"
            value={draft.action ?? ''}
          />
          <Input
            aria-label="Start date"
            onChange={(event) => {
              setDraft((current) => ({ ...current, from: event.target.value }));
            }}
            type="date"
            value={draft.from ?? ''}
          />
          <Input
            aria-label="End date"
            onChange={(event) => {
              setDraft((current) => ({ ...current, to: event.target.value }));
            }}
            type="date"
            value={draft.to ?? ''}
          />
          <select
            aria-label="Filter by result"
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            onChange={(event) => {
              const result = event.target.value as AuditResult | '';
              setDraft((current) => ({
                ...current,
                ...(result === '' ? { result: undefined } : { result }),
              }));
            }}
            value={draft.result ?? ''}
          >
            <option value="">All results</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILURE">Failure</option>
          </select>
          <Button className="gap-2" type="submit">
            <Search className="size-4" /> Apply
          </Button>
        </form>

        {errorMessage === null ? null : (
          <div className="m-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <CircleAlert className="size-5" /> {errorMessage}
          </div>
        )}

        {auditQuery.isPending ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <LoaderCircle className="size-5 animate-spin" /> Loading audit events…
          </div>
        ) : auditQuery.data?.items.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">No audit events found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Actor</th>
                  <th className="px-5 py-3 font-semibold">Action</th>
                  <th className="px-5 py-3 font-semibold">Result</th>
                  <th className="px-5 py-3 font-semibold">Resource</th>
                  <th className="px-5 py-3 font-semibold">IP address</th>
                  <th className="px-5 py-3 font-semibold">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {auditQuery.data?.items.map((event) => (
                  <AuditRow event={event} key={event.id} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          onPage={setPage}
          page={auditQuery.data?.page ?? page}
          totalPages={auditQuery.data?.totalPages ?? 0}
        />
      </section>
    </div>
  );
}

function AuditRow({ event }: { event: AuditRecord }) {
  return (
    <tr className="align-top hover:bg-slate-50">
      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
        {dateFormatter.format(new Date(event.createdAt))}
      </td>
      <td className="px-5 py-4">
        <div className="font-medium text-slate-900">{event.actor?.fullName ?? 'System'}</div>
        <div className="mt-0.5 text-xs text-slate-500">{event.actor?.email ?? 'No account'}</div>
      </td>
      <td className="px-5 py-4">
        <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-800">
          {event.action}
        </code>
      </td>
      <td className="px-5 py-4">
        <Badge tone={event.result === 'SUCCESS' ? 'success' : 'danger'}>{event.result}</Badge>
      </td>
      <td className="px-5 py-4">
        <div className="text-slate-800">{event.resourceType}</div>
        <code className="text-xs text-slate-500">{event.resourceId ?? '—'}</code>
      </td>
      <td className="px-5 py-4 text-slate-600">{event.ipAddress ?? '—'}</td>
      <td className="max-w-sm px-5 py-4">
        <code className="line-clamp-3 break-all text-xs text-slate-600">
          {event.metadata === null ? '—' : JSON.stringify(event.metadata)}
        </code>
      </td>
    </tr>
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

function normalizeFilters(filters: AuditFilters): AuditFilters {
  const action = filters.action?.trim();
  const actor = filters.actor?.trim();
  return {
    ...(action === undefined || action === '' ? {} : { action }),
    ...(actor === undefined || actor === '' ? {} : { actor }),
    ...(filters.from === undefined || filters.from === '' ? {} : { from: filters.from }),
    ...(filters.result === undefined ? {} : { result: filters.result }),
    ...(filters.to === undefined || filters.to === '' ? {} : { to: filters.to }),
  };
}
