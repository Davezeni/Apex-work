/**
 * File-upload gateway backed by Supabase Storage.
 *
 * The normal path is a short-lived signed URL so the browser can upload
 * directly to Supabase. Some mobile networks, privacy browsers, and in-app
 * browsers block cross-origin PUTs even when Supabase CORS is configured
 * correctly. For those clients we also expose an authenticated, raw-byte
 * proxy path. The proxy never writes to disk and is capped per bucket.
 *
 * Docs:
 * - https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl
 * - Signed upload URLs are one-shot and expire after ~2 hours by default.
 *
 * Why service_role: the anon key can't create signed upload URLs; only the
 * server-side service_role key can. That key MUST never reach the browser.
 */
import type { IncomingMessage } from 'node:http';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { BadRequestError } from '../lib/errors.js';
import { randomToken } from '../lib/hash.js';

export type StorageBucket = 'portfolio' | 'chat-attachments' | 'avatars';

const MAX_MB_PER_BUCKET: Record<StorageBucket, number> = {
  avatars: 5,
  portfolio: 25,
  'chat-attachments': 25,
};

/**
 * Browsers do not always report a useful MIME type (notably for Office files
 * and files selected from Android document providers). Keep the allowlist
 * explicit, but infer a type from a known extension when the browser reports
 * application/octet-stream or an empty type.
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.rtf': 'application/rtf',
};

// Common files that are useful in a freelance brief, portfolio, review, or
// chat attachment. `application/octet-stream` is allowed only for chat: some
// Android/iOS document pickers provide no MIME at all, and the file is still
// protected by the size cap and authenticated upload path.
const COMMON_DOCUMENTS =
  'application/pdf|application/msword|application/vnd\\.openxmlformats-officedocument\\.(wordprocessingml\\.document|spreadsheetml\\.sheet|presentationml\\.presentation)|application/vnd\\.ms-(excel|powerpoint)|text/(plain|csv)|application/rtf';

const MIME_ALLOWLIST: Record<StorageBucket, RegExp> = {
  avatars: /^image\/(jpeg|png|webp)$/,
  portfolio: new RegExp(
    `^(image\\/(jpeg|png|webp|gif)|video\\/(mp4|webm|quicktime)|${COMMON_DOCUMENTS})$`,
  ),
  'chat-attachments': new RegExp(
    `^(image\\/(jpeg|png|webp|gif)|audio\\/(webm|mpeg|ogg|wav|mp4)|video\\/(mp4|webm|quicktime)|${COMMON_DOCUMENTS}|application\\/octet-stream)$`,
  ),
};

export interface SignedUploadRequest {
  bucket: StorageBucket;
  filename: string;
  contentType: string;
  sizeBytes: number;
  /** Namespace path prefix so users can't overwrite each others' files. */
  ownerId: string;
}

export interface SignedUploadResult {
  /** Client PUTs the bytes here when the signed flow is used. */
  uploadUrl: string;
  /** Token client must add as a query parameter for signed flow. */
  token: string;
  /** Final public URL to store in the DB after upload succeeds. */
  publicUrl: string;
  /** Server-generated path (never trust client-provided paths). */
  path: string;
  /** Normalized MIME type that was sent to Storage. */
  contentType: string;
  /** Actual bytes accepted by the API. */
  sizeBytes: number;
}

export class StorageService {
  isConfigured(): boolean {
    return !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  }

  maxBytes(bucket: StorageBucket): number {
    return MAX_MB_PER_BUCKET[bucket] * 1024 * 1024;
  }

  /** Remove codec/charset parameters and infer Office/document types by extension. */
  normalizeContentType(contentType: string, filename = ''): string {
    const bare = (contentType.split(';')[0] ?? '').trim().toLowerCase();
    if (bare && bare !== 'application/octet-stream') return bare;

    const dot = filename.lastIndexOf('.');
    const extension = dot >= 0 ? filename.slice(dot).toLowerCase() : '';
    return (MIME_BY_EXTENSION[extension] ?? bare) || 'application/octet-stream';
  }

  validate(
    req: Pick<SignedUploadRequest, 'bucket' | 'contentType' | 'sizeBytes'> & {
      filename?: string;
    },
  ): { ok: boolean; error?: string; contentType: string } {
    const contentType = this.normalizeContentType(req.contentType, req.filename);
    const maxBytes = this.maxBytes(req.bucket);
    if (req.sizeBytes <= 0 || req.sizeBytes > maxBytes) {
      return {
        ok: false,
        error: `File too large. Max ${MAX_MB_PER_BUCKET[req.bucket]}MB.`,
        contentType,
      };
    }
    if (!MIME_ALLOWLIST[req.bucket].test(contentType)) {
      return { ok: false, error: `File type "${contentType}" not allowed here.`, contentType };
    }
    return { ok: true, contentType };
  }

  /**
   * Build a deterministic, namespaced storage path:
   *   {userId}/{yyyy}/{mm}/{random}-{safeFilename}
   * The random slug prevents guessable URLs; the userId prefix scopes
   * ownership; the date fragment makes bulk cleanup easier later.
   */
  private buildPath(ownerId: string, filename: string): string {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const rand = randomToken(6);
    const safe = filename
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'file';
    return `${ownerId}/${y}/${m}/${rand}-${safe}`;
  }

  private objectEndpoint(bucket: StorageBucket, path: string): string {
    // `buildPath` sanitizes every filename character and the owner id is
    // supplied by a verified JWT. Keep the slash separators literal: the
    // Storage API treats them as a structured object key.
    return `${env.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;
  }

  private publicUrl(bucket: StorageBucket, path: string): string {
    return `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  }

  async createSignedUpload(req: SignedUploadRequest): Promise<SignedUploadResult> {
    if (!this.isConfigured()) throw new Error('Storage is not configured');

    const check = this.validate(req);
    if (!check.ok) throw new BadRequestError(check.error ?? 'Invalid upload');

    const path = this.buildPath(req.ownerId, req.filename);
    // Do NOT wrap `path` in encodeURIComponent — that turns every `/` into
    // `%2F`, while Supabase expects the user/year/month separators literally.
    const endpoint =
      `${env.SUPABASE_URL}/storage/v1/object/upload/sign/${req.bucket}/${path}`;

    const sign = async (): Promise<{ status: number; body: string }> => {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      return { status: res.status, body: await res.text().catch(() => '') };
    };

    // On a 400/404 the bucket simply doesn't exist yet (fresh project, or it
    // was deleted). Provision it, then retry the sign once. Keeps uploads
    // working even if boot-time provisioning was skipped or a bucket is gone.
    let res = await sign();
    if (res.status === 400 || res.status === 404) {
      logger.warn({ status: res.status, bucket: req.bucket }, 'Supabase sign 404/400 — ensuring bucket, retrying');
      await ensureStorageBuckets();
      res = await sign();
    }

    if (res.status !== 200) {
      logger.error({ status: res.status, text: res.body.slice(0, 300) }, 'Supabase signed URL failed');
      throw new Error(`Storage sign failed (${res.status})`);
    }

    // `createSignedUploadUrl` returns `{ signedURL, token, path }` in modern
    // supabase-js; older releases used `url`. Accept both, plus the raw string.
    let data: { url?: string; signedURL?: string; signedUrl?: string; token?: string };
    try {
      data = JSON.parse(res.body);
    } catch {
      throw new Error('Malformed sign response');
    }
    const rawUrl = data.url ?? data.signedURL ?? data.signedUrl;
    if (!rawUrl || !data.token) throw new Error('Malformed sign response');

    // Storage returns an absolute URL in modern releases, or a relative
    // `/object/...` path in others. Normalize both.
    const uploadUrl = rawUrl.startsWith('http')
      ? rawUrl
      : rawUrl.startsWith('/storage/v1')
        ? `${env.SUPABASE_URL}${rawUrl}`
        : `${env.SUPABASE_URL}/storage/v1/${rawUrl.replace(/^\//, '')}`;

    return {
      uploadUrl,
      token: data.token,
      publicUrl: this.publicUrl(req.bucket, path),
      path,
      contentType: check.contentType,
      sizeBytes: req.sizeBytes,
    };
  }

  /**
   * Fallback for clients that cannot complete a cross-origin PUT. The body is
   * the raw file, not multipart/form-data, so Express never buffers it in a
   * JSON parser and Render does not need a temporary disk file.
   */
  async uploadProxy(
    req: IncomingMessage,
    input: Omit<SignedUploadRequest, 'sizeBytes'> & { declaredSizeBytes?: number },
  ): Promise<SignedUploadResult> {
    if (!this.isConfigured()) throw new Error('Storage is not configured');

    const contentType = this.normalizeContentType(input.contentType, input.filename);
    const typeCheck = this.validate({
      bucket: input.bucket,
      filename: input.filename,
      contentType,
      // A missing Content-Length is allowed; the stream is checked below.
      sizeBytes: Math.max(1, input.declaredSizeBytes ?? 1),
    });
    if (!typeCheck.ok) throw new BadRequestError(typeCheck.error ?? 'Invalid upload');

    const maxBytes = this.maxBytes(input.bucket);
    if ((input.declaredSizeBytes ?? 0) > maxBytes) {
      throw new BadRequestError(`File too large. Max ${MAX_MB_PER_BUCKET[input.bucket]}MB.`);
    }

    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      total += buffer.length;
      if (total > maxBytes) {
        req.destroy();
        throw new BadRequestError(`File too large. Max ${MAX_MB_PER_BUCKET[input.bucket]}MB.`);
      }
      chunks.push(buffer);
    }
    if (total <= 0) throw new BadRequestError('The selected file is empty.');

    const path = this.buildPath(input.ownerId, input.filename);
    const res = await fetch(this.objectEndpoint(input.bucket, path), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
        'Content-Type': contentType,
        'x-upsert': 'false',
        'Content-Length': String(total),
      },
      body: Buffer.concat(chunks),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error(
        { status: res.status, text: text.slice(0, 500), bucket: input.bucket },
        'Supabase proxy upload failed',
      );
      throw new Error(`Storage upload failed (${res.status})`);
    }

    return {
      uploadUrl: '',
      token: '',
      publicUrl: this.publicUrl(input.bucket, path),
      path,
      contentType,
      sizeBytes: total,
    };
  }
}

export const storage = new StorageService();

/**
 * Ensure the required Storage buckets exist. Runs once at boot. Idempotent:
 * creating a bucket that already exists returns 409, which we treat as OK.
 * This removes the manual Supabase-dashboard setup step that otherwise makes
 * every signed/proxy upload 404 ("bucket not found").
 */
export async function ensureStorageBuckets(): Promise<void> {
  if (!storage.isConfigured()) return;
  const existing: string[] = [];
  try {
    const res = await fetch(`${env.SUPABASE_URL}/storage/v1/bucket`, {
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
      },
    });
    if (res.ok) {
      const list = (await res.json()) as { name?: string }[];
      for (const b of list) if (b.name) existing.push(b.name);
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Storage bucket listing failed (non-fatal)');
    return;
  }

  for (const bucket of Object.keys(MAX_MB_PER_BUCKET) as StorageBucket[]) {
    if (existing.includes(bucket)) continue;
    try {
      const res = await fetch(`${env.SUPABASE_URL}/storage/v1/bucket`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: bucket,
          name: bucket,
          public: true,
          file_size_limit: MAX_MB_PER_BUCKET[bucket] * 1024 * 1024,
          allowed_mime_types: null,
        }),
      });
      const created = res.ok || res.status === 409;
      logger.info({ bucket, status: res.status }, created ? 'Storage bucket ensured' : 'Storage bucket create failed');
    } catch (err) {
      logger.warn({ bucket, err: (err as Error).message }, 'Storage bucket create skipped (non-fatal)');
    }
  }
}

// Log status once at boot so a broken config is visible in Render logs
// without having to hit an upload endpoint first.
if (storage.isConfigured()) {
  logger.info('Storage: Supabase configured');
} else {
  logger.warn('Storage: Supabase NOT configured — upload routes will 409');
}

// Fire the bucket provisioning at boot, but never block startup on it.
void ensureStorageBuckets();
