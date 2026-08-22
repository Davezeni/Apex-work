/**
 * File-upload gateway backed by Supabase Storage.
 *
 * Rather than proxy raw bytes through our API (slow + Render's tiny disk),
 * we mint a short-lived signed upload URL and let the browser PUT directly
 * to Supabase. The client then POSTs the resulting public URL back to us
 * so we can attach it to a portfolio item, chat message, etc.
 *
 * Docs:
 * - https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl
 * - Signed upload URLs are one-shot and expire after ~2 hours by default.
 *
 * Why service_role: the anon key can't create signed upload URLs; only the
 * server-side service_role key can. That key MUST never reach the browser.
 */
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { randomToken } from '../lib/hash.js';

export type StorageBucket = 'portfolio' | 'chat-attachments' | 'avatars';

const MAX_MB_PER_BUCKET: Record<StorageBucket, number> = {
  avatars: 5,
  portfolio: 25,
  'chat-attachments': 25,
};

// Whitelist mirrors what we configured on the bucket itself (defense-in-depth).
const MIME_ALLOWLIST: Record<StorageBucket, RegExp> = {
  avatars: /^image\/(jpeg|png|webp)$/,
  portfolio: /^(image\/(jpeg|png|webp|gif)|video\/mp4|application\/pdf)$/,
  'chat-attachments':
    /^(image\/(jpeg|png|webp|gif)|audio\/(webm|mpeg|ogg)|video\/mp4|application\/pdf)$/,
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
  /** Client PUTs the bytes here. */
  uploadUrl: string;
  /** Token client must add as header/body. */
  token: string;
  /** Final public URL to store in the DB after upload succeeds. */
  publicUrl: string;
  /** Server-generated path (never trust client-provided paths). */
  path: string;
}

export class StorageService {
  isConfigured(): boolean {
    return !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  }

  validate(req: Pick<SignedUploadRequest, 'bucket' | 'contentType' | 'sizeBytes'>): {
    ok: boolean;
    error?: string;
  } {
    const maxBytes = MAX_MB_PER_BUCKET[req.bucket] * 1024 * 1024;
    if (req.sizeBytes <= 0 || req.sizeBytes > maxBytes) {
      return { ok: false, error: `File too large. Max ${MAX_MB_PER_BUCKET[req.bucket]}MB.` };
    }
    if (!MIME_ALLOWLIST[req.bucket].test(req.contentType)) {
      return { ok: false, error: `File type "${req.contentType}" not allowed here.` };
    }
    return { ok: true };
  }

  /**
   * Build a deterministic, namespaced storage path:
   *   {bucket}/{userId}/{yyyy}/{mm}/{random}-{safeFilename}
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

  async createSignedUpload(req: SignedUploadRequest): Promise<SignedUploadResult> {
    if (!this.isConfigured()) throw new Error('Storage is not configured');

    const path = this.buildPath(req.ownerId, req.filename);
    const endpoint =
      `${env.SUPABASE_URL}/storage/v1/object/upload/sign/${req.bucket}/${encodeURIComponent(path)}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error({ status: res.status, text }, 'Supabase signed URL failed');
      throw new Error(`Storage sign failed (${res.status})`);
    }

    const data = (await res.json()) as { url?: string; token?: string };
    if (!data.url || !data.token) throw new Error('Malformed sign response');

    const uploadUrl = data.url.startsWith('http')
      ? data.url
      : `${env.SUPABASE_URL}${data.url}`;

    const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${req.bucket}/${path}`;

    return {
      uploadUrl,
      token: data.token,
      publicUrl,
      path,
    };
  }
}

export const storage = new StorageService();

// Log status once at boot so a broken config is visible in Render logs
// without having to hit an upload endpoint first.
if (storage.isConfigured()) {
  logger.info('Storage: Supabase configured');
} else {
  logger.warn('Storage: Supabase NOT configured — /uploads/sign will 409');
}
