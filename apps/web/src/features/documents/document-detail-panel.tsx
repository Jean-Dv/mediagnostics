import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Clipboard,
  Download,
  Eye,
  EyeOff,
  FileImage,
  LoaderCircle,
  Send,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { ApiError } from '@/api/client';
import {
  downloadDocument,
  getDocumentPreview,
  publishDocument,
  recordDocumentPasswordCopy,
  revealDocumentPassword,
  type DocumentSummary,
} from '@/api/documents';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { DocumentStatusBadge, documentTypeLabel, formatDocumentDate } from './document-ui';

function useObjectUrl(blob: Blob | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (blob === undefined) return;
    const nextUrl = URL.createObjectURL(blob);
    setUrl(nextUrl);
    return () => {
      URL.revokeObjectURL(nextUrl);
      setUrl(null);
    };
  }, [blob]);
  return url;
}

export function DocumentDetailPanel({
  document,
  mode,
  onClose,
  onPublished,
}: {
  document: DocumentSummary;
  mode: 'operator' | 'patient';
  onClose: () => void;
  onPublished?: (document: DocumentSummary) => void;
}) {
  const queryClient = useQueryClient();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [copyComplete, setCopyComplete] = useState(false);
  const [publishConfirmationOpen, setPublishConfirmationOpen] = useState(false);
  const previewQuery = useQuery({
    queryFn: () => getDocumentPreview(document.id),
    queryKey: ['document-preview', document.id],
    retry: false,
  });
  const previewUrl = useObjectUrl(previewQuery.data);
  const downloadMutation = useMutation({
    mutationFn: () => downloadDocument(document.id),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = `mediagnostics-${document.id}.pdf`;
      anchor.click();
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1_000);
    },
  });
  const passwordMutation = useMutation({
    mutationFn: () => revealDocumentPassword(document.id),
    onSuccess: () => {
      setPasswordVisible(true);
    },
  });
  const publishMutation = useMutation({
    mutationFn: () => publishDocument(document.id),
    onSuccess: (published) => {
      setPublishConfirmationOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      onPublished?.(published);
    },
  });

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !publishConfirmationOpen) onClose();
    };
    const previousOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose, publishConfirmationOpen]);

  const copyPassword = async () => {
    const password = passwordMutation.data;
    if (password === undefined) return;
    await navigator.clipboard.writeText(password);
    await recordDocumentPasswordCopy(document.id);
    setCopyComplete(true);
    window.setTimeout(() => {
      setCopyComplete(false);
    }, 2_000);
  };

  const mutationError =
    downloadMutation.error ?? passwordMutation.error ?? publishMutation.error ?? null;
  const errorMessage =
    mutationError instanceof ApiError
      ? mutationError.message
      : mutationError === null
        ? null
        : 'The action could not be completed.';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-[2px]">
      <button aria-label="Close document details" className="flex-1" onClick={onClose} />
      <aside
        aria-label="Document details"
        className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-7">
          <div className="min-w-0">
            <DocumentStatusBadge status={document.status} />
            <h2 className="mt-3 truncate text-xl font-semibold text-slate-950">{document.title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {documentTypeLabel(document.type)} · {formatDocumentDate(document.documentDate)}
            </p>
          </div>
          <Button aria-label="Close" onClick={onClose} size="sm" variant="ghost">
            <X aria-hidden="true" className="size-5" />
          </Button>
        </header>

        <div className="space-y-6 p-5 sm:p-7">
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Processed preview
            </h3>
            <div className="mt-3 flex min-h-64 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              {previewQuery.isPending ? (
                <div className="text-center text-sm text-slate-500">
                  <LoaderCircle className="mx-auto mb-2 size-5 animate-spin" /> Loading preview…
                </div>
              ) : previewQuery.isError || previewUrl === null ? (
                <div className="px-6 text-center text-sm text-slate-500">
                  <FileImage className="mx-auto mb-2 size-7" /> The processed preview is not
                  available.
                </div>
              ) : (
                <img
                  alt={`Preview of ${document.title}`}
                  className="max-h-[60vh] w-full object-contain"
                  src={previewUrl}
                />
              )}
            </div>
          </section>

          <section className="grid gap-4 rounded-xl border border-slate-200 p-5 sm:grid-cols-2">
            <Detail label="Patient" value={document.patient.fullName} />
            <Detail label="Clinical code" value={document.patient.clinicalCode} />
            <Detail label="Pages" value={document.pageCount?.toString() ?? '—'} />
            <Detail
              label={document.type === 'LAB_RESULT' ? 'Exam' : 'Procedure'}
              value={document.examType ?? document.procedureName ?? '—'}
            />
            {document.description === null ? null : (
              <div className="sm:col-span-2">
                <Detail label="Description" value={document.description} />
              </div>
            )}
          </section>

          {mode === 'patient' ? (
            <section className="rounded-xl border border-teal-200 bg-teal-50 p-5">
              <h3 className="font-semibold text-slate-950">PDF password</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                The downloaded PDF is protected. Reveal and copy its unique password when needed.
              </p>
              {passwordMutation.data === undefined ? (
                <Button
                  className="mt-4 gap-2"
                  disabled={passwordMutation.isPending}
                  onClick={() => {
                    passwordMutation.mutate();
                  }}
                  type="button"
                >
                  {passwordMutation.isPending ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                  Reveal password
                </Button>
              ) : (
                <div className="mt-4">
                  <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-white p-2">
                    <code className="min-w-0 flex-1 truncate px-2 font-mono text-sm font-semibold text-slate-950">
                      {passwordVisible ? passwordMutation.data : '••••••••••••••••'}
                    </code>
                    <Button
                      aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                      onClick={() => {
                        setPasswordVisible((current) => !current);
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      {passwordVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                    <Button className="gap-2" onClick={() => void copyPassword()} size="sm">
                      {copyComplete ? (
                        <Check className="size-4" />
                      ) : (
                        <Clipboard className="size-4" />
                      )}
                      {copyComplete ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>
              )}
            </section>
          ) : null}

          {errorMessage === null ? null : (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {errorMessage}
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <Button
              className="gap-2"
              disabled={downloadMutation.isPending}
              onClick={() => {
                downloadMutation.mutate();
              }}
              type="button"
              variant="outline"
            >
              {downloadMutation.isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Download protected PDF
            </Button>
            {mode === 'operator' && document.status === 'READY_TO_PUBLISH' ? (
              <Button
                className="gap-2"
                disabled={publishMutation.isPending}
                onClick={() => {
                  setPublishConfirmationOpen(true);
                }}
                type="button"
              >
                {publishMutation.isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Publish document
              </Button>
            ) : null}
          </div>
        </div>
      </aside>
      {publishConfirmationOpen ? (
        <Modal
          description="The patient will immediately be able to view and download the processed document."
          onClose={() => {
            if (!publishMutation.isPending) setPublishConfirmationOpen(false);
          }}
          title="Publish document?"
        >
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="font-medium text-slate-950">{document.title}</div>
            <div className="mt-1 text-sm text-slate-600">
              {document.patient.fullName} · {document.patient.clinicalCode}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {documentTypeLabel(document.type)} · {formatDocumentDate(document.documentDate)}
            </div>
          </div>
          {publishMutation.error === null ? null : (
            <div
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {publishMutation.error instanceof ApiError
                ? publishMutation.error.message
                : 'The document could not be published.'}
            </div>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <Button
              disabled={publishMutation.isPending}
              onClick={() => {
                setPublishConfirmationOpen(false);
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="gap-2"
              disabled={publishMutation.isPending}
              onClick={() => {
                publishMutation.mutate();
              }}
              type="button"
            >
              {publishMutation.isPending ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Send aria-hidden="true" className="size-4" />
              )}
              {publishMutation.isPending ? 'Publishing…' : 'Publish document'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-900">{value}</div>
    </div>
  );
}
