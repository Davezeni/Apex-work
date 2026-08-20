/**
 * Ambient / utility types shared across the app.
 * Prefer Zod-inferred types (from schemas) where possible.
 */

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: { code: string; message: string; details?: unknown } };
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export type Paginated<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

/** Distributed nullable helper */
export type Nullable<T> = T | null;

/** Deep partial */
export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
