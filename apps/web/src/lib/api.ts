import type { ApiFailure, ApiSuccess } from '@apex-work/shared';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'production'
    ? 'https://apex-work-api.onrender.com'
    : 'http://localhost:4000');

/** Base origin of the Apex-Work API (public, constant across the app). */
export const API_BASE = API_URL;

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

/** Concurrent-refresh guard so only one refresh runs at a time. */
let refreshPromise: Promise<string | null> | null = null;

/**
 * Try to exchange the stored refresh token for a fresh access token.
 * Smoothly handles the common "Invalid or expired token" after the 15-minute
 * access-token lifespan. Updates the auth store on success and clears the
 * session if the refresh token is also dead.
 */
async function refreshAccessToken(): Promise<string | null> {
  const { useAuthStore } = await import('@/stores/auth-store');
  const { accessToken: old, refreshToken } = useAuthStore.getState();
  if (!refreshToken) return null;

  refreshPromise ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        credentials: 'include',
      });
      const json = (await res.json()) as
        ApiSuccess<{ accessToken: string; refreshToken: string; expiresIn: number }> | ApiFailure;
      const data = (
        json as
          { data?: { accessToken: string; refreshToken: string; expiresIn: number } } | undefined
      )?.data;
      if (!res.ok || !data?.accessToken) {
        useAuthStore.getState().clear();
        return null;
      }
      useAuthStore
        .getState()
        .setSession({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresIn: data.expiresIn,
        });
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Typed fetch wrapper — throws ApiError on non-2xx.
 * Returns the `data` payload directly on success.
 *
 * If the call surfaces a 401 because the access token expired, it silently
 * refreshes the session and replays the request once. This is what keeps long
 * chat/voice sessions from dying with "Invalid or expired token".
 */
export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, token, headers, ...rest } = opts;
  // Prefer an explicit token, otherwise the freshest one in the store.
  let activeToken =
    token ?? (await import('@/stores/auth-store')).useAuthStore.getState().accessToken;

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${API_URL}/v1${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
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

    // Access token expired → refresh once and replay, unless the very call
    // we're trying to refresh was itself an auth call.
    if (res.status === 401 && attempt === 0 && !path.startsWith('/auth/')) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        activeToken = refreshed;
        continue;
      }
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

  // Unreachable in practice, but satisfies the compiler.
  throw new ApiError(401, 'UNAUTHORIZED', 'Session expired');
}

/**
 * Fetch an authenticated attachment (e.g. an HTML receipt / statement served
 * with Content-Disposition) and trigger a browser download. Throws ApiError on
 * a non-2xx response.
 */
export async function downloadViaAuth(
  path: string,
  token: string | null | undefined,
  filename?: string,
): Promise<void> {
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
