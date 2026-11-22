import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileText,
  FlaskConical,
  LoaderCircle,
  Search,
  ShieldCheck,
  Upload,
  UserRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { ApiError } from '@/api/client';
import {
  getDocument,
  getReplacementCandidates,
  searchPatients,
  uploadDocument,
  type DocumentSummary,
  type DocumentType,
  type PatientOption,
  type UploadAction,
} from '@/api/documents';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const maximumFileSize = 10 * 1024 * 1024;

const stages = [
  { label: 'Select patient', number: 1 },
  { label: 'Document details', number: 2 },
  { label: 'Upload & review', number: 3 },
] as const;

interface Details {
  description: string;
  documentDate: string;
  examType: string;
  procedureName: string;
  title: string;
  type: DocumentType;
}

const initialDetails: Details = {
  description: '',
  documentDate: new Date().toISOString().slice(0, 10),
  examType: '',
  procedureName: '',
  title: '',
  type: 'LAB_RESULT',
};

export function DocumentUploadWizard() {
  const [stage, setStage] = useState(1);
  const [patientSearch, setPatientSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [patient, setPatient] = useState<PatientOption | null>(null);
  const [details, setDetails] = useState<Details>(initialDetails);
  const [replacesId, setReplacesId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [completedDocument, setCompletedDocument] = useState<DocumentSummary | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(patientSearch.trim());
    }, 300);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [patientSearch]);

  const patientsQuery = useQuery({
    enabled: debouncedSearch.length >= 2 && patient === null,
    queryFn: () => searchPatients(debouncedSearch),
    queryKey: ['patient-search', debouncedSearch],
    staleTime: 15_000,
  });

  const replacementCandidatesQuery = useQuery({
    enabled: patient !== null && stage >= 2,
    queryFn: () => getReplacementCandidates(patient?.id ?? '', details.type),
    queryKey: ['replacement-candidates', patient?.id, details.type],
  });

  const uploadMutation = useMutation({
    mutationFn: (action: UploadAction) => {
      if (patient === null || file === null) {
        throw new Error('The upload is incomplete.');
      }
      return uploadDocument({
        ...details,
        action,
        file,
        patientId: patient.id,
        ...(replacesId === '' ? {} : { replacesId }),
      });
    },
    onSuccess: (document) => {
      setCompletedDocument(document);
    },
  });

  const statusQuery = useQuery({
    enabled: completedDocument !== null && completedDocument.status !== 'DRAFT',
    queryFn: () => getDocument(completedDocument?.id ?? ''),
    queryKey: ['document', completedDocument?.id],
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'PENDING' || status === 'PROCESSING' ? 3_000 : false;
    },
  });

  const updateDetails = (field: keyof Details, value: string) => {
    setDetails((current) => ({ ...current, [field]: value }));
    setValidationError(null);
  };

  const selectFile = (selectedFile: File | undefined) => {
    if (selectedFile === undefined) return;
    if (
      selectedFile.type !== 'application/pdf' &&
      !selectedFile.name.toLowerCase().endsWith('.pdf')
    ) {
      setFile(null);
      setValidationError('Select a PDF file.');
      return;
    }
    if (selectedFile.size > maximumFileSize) {
      setFile(null);
      setValidationError('The PDF must be 10 MB or smaller.');
      return;
    }
    setFile(selectedFile);
    setValidationError(null);
  };

  const goForward = () => {
    if (stage === 1 && patient === null) {
      setValidationError('Select a patient before continuing.');
      return;
    }
    if (stage === 2) {
      const conditionalValue =
        details.type === 'LAB_RESULT' ? details.examType : details.procedureName;
      if (
        details.title.trim().length < 2 ||
        details.documentDate.length === 0 ||
        conditionalValue.trim().length < 2
      ) {
        setValidationError('Complete all required document details.');
        return;
      }
    }
    setValidationError(null);
    setStage((current) => Math.min(3, current + 1));
  };

  const resetWizard = () => {
    setStage(1);
    setPatientSearch('');
    setDebouncedSearch('');
    setPatient(null);
    setDetails({ ...initialDetails, documentDate: new Date().toISOString().slice(0, 10) });
    setReplacesId('');
    setFile(null);
    setValidationError(null);
    setCompletedDocument(null);
    uploadMutation.reset();
  };

  if (completedDocument !== null) {
    const currentDocument = statusQuery.data ?? completedDocument;
    const processing =
      currentDocument.status === 'PENDING' || currentDocument.status === 'PROCESSING';
    const failed = currentDocument.status === 'FAILED';
    const ready = currentDocument.status === 'READY_TO_PUBLISH';
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm sm:px-10">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <CheckCircle2 aria-hidden="true" className="size-7" />
        </div>
        <Badge tone={failed ? 'danger' : ready ? 'success' : processing ? 'teal' : 'neutral'}>
          {currentDocument.status === 'PENDING'
            ? 'Processing queued'
            : currentDocument.status === 'PROCESSING'
              ? 'Processing document'
              : currentDocument.status === 'READY_TO_PUBLISH'
                ? 'Ready to publish'
                : currentDocument.status === 'FAILED'
                  ? 'Processing failed'
                  : 'Draft saved'}
        </Badge>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
          {currentDocument.title}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
          {failed
            ? 'The original PDF remains secure and can be retried from the document details.'
            : ready
              ? 'Processing finished. Review the generated preview before publishing this document.'
              : processing
                ? 'The PDF was stored securely and is being processed by the worker.'
                : 'The PDF and its metadata were saved without starting processing.'}
        </p>
        {processing ? (
          <div className="mx-auto mt-5 flex w-fit items-center gap-2 text-sm text-teal-700">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Status updates automatically
          </div>
        ) : null}
        <Button className="mt-7" onClick={resetWizard} type="button">
          Upload another document
        </Button>
      </section>
    );
  }

  const requestError =
    uploadMutation.error instanceof ApiError
      ? uploadMutation.error.message
      : uploadMutation.isError
        ? 'The document could not be uploaded.'
        : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-5 sm:px-7">
        <ol className="grid grid-cols-3 gap-2" aria-label="Upload progress">
          {stages.map((item) => (
            <li className="relative" key={item.number}>
              <div
                className={cn(
                  'flex items-center gap-2 text-xs font-semibold sm:text-sm',
                  stage >= item.number ? 'text-teal-800' : 'text-slate-400',
                )}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs',
                    stage > item.number && 'border-teal-700 bg-teal-700 text-white',
                    stage === item.number && 'border-teal-700 bg-white text-teal-800',
                    stage < item.number && 'border-slate-300 bg-white text-slate-400',
                  )}
                >
                  {stage > item.number ? (
                    <Check aria-hidden="true" className="size-4" />
                  ) : (
                    item.number
                  )}
                </span>
                <span className="hidden sm:inline">{item.label}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="p-5 sm:p-8">
        {stage === 1 ? (
          <div className="mx-auto max-w-2xl">
            <StageHeading
              description="Search active patient accounts by name, email, or clinical code."
              icon={UserRound}
              title="Who is this document for?"
            />
            {patient === null ? (
              <div className="mt-7">
                <div className="relative">
                  <Search
                    aria-hidden="true"
                    className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    autoFocus
                    className="h-12 pl-10"
                    onChange={(event) => {
                      setPatientSearch(event.target.value);
                    }}
                    placeholder="Enter at least 2 characters"
                    value={patientSearch}
                  />
                </div>
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                  {patientSearch.trim().length < 2 ? (
                    <p className="px-4 py-5 text-sm text-slate-500">
                      Type at least 2 characters to search.
                    </p>
                  ) : patientsQuery.isFetching ? (
                    <div className="flex items-center gap-2 px-4 py-5 text-sm text-slate-500">
                      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Searching
                      patients…
                    </div>
                  ) : patientsQuery.isError ? (
                    <p className="px-4 py-5 text-sm text-red-700">
                      Patients could not be loaded. Check the connection and try again.
                    </p>
                  ) : patientsQuery.data?.length === 0 ? (
                    <p className="px-4 py-5 text-sm text-slate-500">
                      No active patients matched your search.
                    </p>
                  ) : (
                    patientsQuery.data?.map((option) => (
                      <button
                        className="flex w-full items-center gap-4 border-b border-slate-200 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
                        key={option.id}
                        onClick={() => {
                          setPatient(option);
                          setReplacesId('');
                          setValidationError(null);
                        }}
                        type="button"
                      >
                        <span className="flex size-9 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                          <UserRound aria-hidden="true" className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-slate-950">
                            {option.fullName}
                          </span>
                          <span className="block truncate text-sm text-slate-500">
                            {option.email}
                          </span>
                        </span>
                        <code className="text-xs text-slate-500">{option.clinicalCode}</code>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-7 rounded-xl border border-teal-200 bg-teal-50 p-5">
                <div className="font-semibold text-slate-950">{patient.fullName}</div>
                <div className="mt-1 text-sm text-slate-600">{patient.email}</div>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <code className="text-sm font-semibold text-teal-800">
                    {patient.clinicalCode}
                  </code>
                  <Button
                    onClick={() => {
                      setPatient(null);
                      setReplacesId('');
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Change
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {stage === 2 ? (
          <div className="mx-auto max-w-2xl">
            <StageHeading
              description="Add the clinical metadata that the patient will see."
              icon={FileText}
              title="Describe the document"
            />
            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <FormField label="Document type">
                <select
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950"
                  onChange={(event) => {
                    updateDetails('type', event.target.value);
                    setReplacesId('');
                  }}
                  value={details.type}
                >
                  <option value="LAB_RESULT">Laboratory result</option>
                  <option value="INFORMED_CONSENT">Informed consent</option>
                </select>
              </FormField>
              <FormField label="Document date">
                <Input
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => {
                    updateDetails('documentDate', event.target.value);
                  }}
                  type="date"
                  value={details.documentDate}
                />
              </FormField>
              <div className="sm:col-span-2">
                <FormField label="Title">
                  <Input
                    maxLength={200}
                    onChange={(event) => {
                      updateDetails('title', event.target.value);
                    }}
                    placeholder="Complete blood count results"
                    value={details.title}
                  />
                </FormField>
              </div>
              <div className="sm:col-span-2">
                {details.type === 'LAB_RESULT' ? (
                  <FormField label="Exam type">
                    <Input
                      maxLength={120}
                      onChange={(event) => {
                        updateDetails('examType', event.target.value);
                      }}
                      placeholder="Complete blood count"
                      value={details.examType}
                    />
                  </FormField>
                ) : (
                  <FormField label="Procedure name">
                    <Input
                      maxLength={120}
                      onChange={(event) => {
                        updateDetails('procedureName', event.target.value);
                      }}
                      placeholder="Blood sample collection"
                      value={details.procedureName}
                    />
                  </FormField>
                )}
              </div>
              <div className="sm:col-span-2">
                <FormField label="Description (optional)">
                  <textarea
                    className="min-h-24 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950"
                    maxLength={500}
                    onChange={(event) => {
                      updateDetails('description', event.target.value);
                    }}
                    placeholder="Add relevant context for this document."
                    value={details.description}
                  />
                </FormField>
              </div>
              <div className="sm:col-span-2">
                <FormField label="Replaces annulled document (optional)">
                  <select
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 disabled:bg-slate-100"
                    disabled={replacementCandidatesQuery.isPending}
                    onChange={(event) => {
                      setReplacesId(event.target.value);
                    }}
                    value={replacesId}
                  >
                    <option value="">
                      {replacementCandidatesQuery.isPending
                        ? 'Loading eligible documents…'
                        : 'This is not a replacement'}
                    </option>
                    {replacementCandidatesQuery.data?.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.title} · {candidate.documentDate.slice(0, 10)}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Only unlinked annulled documents for this patient and document type are shown.
                  </p>
                </FormField>
              </div>
            </div>
          </div>
        ) : null}

        {stage === 3 ? (
          <div className="mx-auto max-w-3xl">
            <StageHeading
              description="Choose the PDF and verify the information before uploading."
              icon={Upload}
              title="Upload and review"
            />
            <label className="mt-7 flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-9 text-center hover:border-teal-500 hover:bg-teal-50/40">
              <Upload aria-hidden="true" className="size-8 text-teal-700" />
              <span className="mt-3 font-medium text-slate-950">
                {file === null ? 'Choose a PDF file' : file.name}
              </span>
              <span className="mt-1 text-sm text-slate-500">
                {file === null
                  ? 'PDF only, up to 10 MB'
                  : `${(file.size / 1024 / 1024).toFixed(2)} MB`}
              </span>
              <input
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(event) => {
                  selectFile(event.target.files?.[0]);
                }}
                type="file"
              />
            </label>

            <div className="mt-6 grid gap-4 rounded-xl border border-slate-200 p-5 sm:grid-cols-2">
              <SummaryItem label="Patient" value={patient?.fullName ?? '—'} />
              <SummaryItem label="Clinical code" value={patient?.clinicalCode ?? '—'} />
              <SummaryItem
                label="Document type"
                value={details.type === 'LAB_RESULT' ? 'Laboratory result' : 'Informed consent'}
              />
              <SummaryItem label="Document date" value={details.documentDate} />
              <SummaryItem label="Title" value={details.title} />
              <SummaryItem
                label={details.type === 'LAB_RESULT' ? 'Exam type' : 'Procedure'}
                value={details.type === 'LAB_RESULT' ? details.examType : details.procedureName}
              />
              <SummaryItem
                label="Replacement"
                value={
                  replacementCandidatesQuery.data?.find((candidate) => candidate.id === replacesId)
                    ?.title ?? 'Not a replacement'
                }
              />
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-xl bg-slate-100 p-4 text-sm leading-6 text-slate-700">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-teal-700" />
              The original PDF will be stored privately. Processing creates the protected copy and
              preview used for publication.
            </div>
          </div>
        ) : null}

        {validationError === null && requestError === null ? null : (
          <div
            className="mx-auto mt-6 max-w-3xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {validationError ?? requestError}
          </div>
        )}
      </div>

      <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Button
          disabled={stage === 1 || uploadMutation.isPending}
          onClick={() => {
            setValidationError(null);
            setStage((current) => Math.max(1, current - 1));
          }}
          type="button"
          variant="ghost"
        >
          <ArrowLeft aria-hidden="true" className="mr-2 size-4" /> Back
        </Button>
        {stage < 3 ? (
          <Button onClick={goForward} type="button">
            Continue <ArrowRight aria-hidden="true" className="ml-2 size-4" />
          </Button>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              disabled={file === null || uploadMutation.isPending}
              onClick={() => {
                uploadMutation.mutate('DRAFT');
              }}
              type="button"
              variant="outline"
            >
              Save as draft
            </Button>
            <Button
              className="gap-2"
              disabled={file === null || uploadMutation.isPending}
              onClick={() => {
                uploadMutation.mutate('PROCESS');
              }}
              type="button"
            >
              {uploadMutation.isPending ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <FlaskConical aria-hidden="true" className="size-4" />
              )}
              Upload and process
            </Button>
          </div>
        )}
      </footer>
    </section>
  );
}

function StageHeading({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: typeof UserRound;
  title: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
        <Icon aria-hidden="true" className="size-5" />
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}
