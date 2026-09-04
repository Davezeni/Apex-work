import type { ApiFailure, ApiSuccess } from '@apex-work/shared';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'production'
    ? 'https://apex-work-api.onrender.com'
    : 'http://localhost:4000');

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  token?: string | null;
}

/**
 * Typed fetch wrapper — throws ApiError on non-2xx.
 * Returns the `data` payload directly on success.
 */
export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, token, headers, ...rest } = opts;
  const res = await fetch(`${API_URL}/v1${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers as Record<string, string>),
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(res.status, 'NETWORK', `Request failed (${res.status})`);
  }

  if (!res.ok || (json as { ok?: boolean }).ok === false) {
    const err = (json as ApiFailure).error ?? {
      code: 'UNKNOWN',
      message: 'Unknown error',
    };
    throw new ApiError(res.status, err.code, err.message, err.details);
  }

  return (json as ApiSuccess<T>).data;
}

/**
 * Fetch an authenticated attachment (e.g. an HTML receipt / statement served
 * with Content-Disposition) and trigger a browser download. Throws ApiError on
 * a non-2xx response.
 */
export async function downloadViaAuth(path: string, token: string | null | undefined, filename?: string): Promise<void> {
  const res = await fetch(`${API_URL}/v1${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: 'include',
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const json = (await res.json()) as ApiFailure;
      msg = json.error?.message ?? msg;
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, 'DOWNLOAD', msg);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const name = filename ?? match?.[1] ?? 'download';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
