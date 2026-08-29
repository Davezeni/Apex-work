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
