export interface ProblemDetails {
  code?: string;
  detail: string;
  instance?: string;
  status: number;
  title: string;
  type?: string;
}

export class ApiError extends Error {
  public readonly code?: string;
  public readonly status: number;

  public constructor(problem: ProblemDetails) {
    super(problem.detail);
    this.name = 'ApiError';
    this.status = problem.status;
    if (problem.code !== undefined) {
      this.code = problem.code;
    }
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const requestBody: BodyInit | undefined =
    options.body === undefined
      ? undefined
      : options.body instanceof FormData
        ? options.body
        : JSON.stringify(options.body);
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body !== undefined && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    body: requestBody,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    throw new ApiError(await readProblemDetails(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiBlob(path: string, accept: string): Promise<Blob> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { Accept: accept },
  });
  if (!response.ok) {
    throw new ApiError(await readProblemDetails(response));
  }
  return response.blob();
}

async function readProblemDetails(response: Response): Promise<ProblemDetails> {
  try {
    const problem = (await response.json()) as Partial<ProblemDetails>;
    return {
      ...(problem.code === undefined ? {} : { code: problem.code }),
      detail: problem.detail ?? 'The request could not be completed.',
      status: problem.status ?? response.status,
      title: problem.title ?? response.statusText,
    };
  } catch {
    return {
      detail: 'The request could not be completed.',
      status: response.status,
      title: response.statusText,
    };
  }
}
