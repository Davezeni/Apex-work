'use client';

import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { UploadBucket } from '@apex-work/shared';

export interface UploadResult {
  publicUrl: string;
  path: string;
  bucket: UploadBucket;
  contentType: string;
  sizeBytes: number;
}

interface SignResponse {
  uploadUrl: string;
  token: string;
  publicUrl: string;
  path: string;
}

/**
 * Upload a file to Supabase Storage via a two-step signed-URL flow:
 *   1) Ask our API to mint a signed upload URL (this validates size+MIME).
 *   2) PUT the raw bytes directly to Supabase — bypasses our server entirely
 *      so we never proxy large files (Render's disk is tiny and CPU-bound).
 *
 * IMPORTANT — matches the Supabase JS SDK's `uploadToSignedUrl` wire format
 * exactly, because the naive "PUT the raw file with Content-Type header"
 * approach fails on Supabase's storage backend. Specifically:
 *   - Body must be `multipart/form-data` with the Blob appended under the
 *     EMPTY key (`body.append('', file)`), plus a `cacheControl` field.
 *   - The auth token goes in the URL as `?token=...` (already baked into
 *     `signed.uploadUrl` by the server), NOT in an Authorization header.
 *   - `x-upsert` header controls whether existing files are replaced.
 *
 * We use XHR (not fetch) purely for the upload progress events.
 *
 * Returns the public URL to persist alongside the domain object
 * (portfolio item, message attachment, avatar).
 */
export function useUpload() {
  const token = useAuthStore((s) => s.accessToken);

  return useMutation<
    UploadResult,
    Error,
    { file: File; bucket: UploadBucket; onProgress?: (pct: number) => void }
  >({
    mutationFn: async ({ file, bucket, onProgress }) => {
      // Step 1 — sign
      const signed = await apiFetch<SignResponse>('/uploads/sign', {
        method: 'POST',
        token,
        body: {
          bucket,
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        },
      });

      // Step 2 — the sign endpoint returns a URL that either already has
      // ?token=... appended, or a bare URL plus a separate token we must
      // append ourselves. Normalise to always have ?token=.
      const uploadUrl = signed.uploadUrl.includes('token=')
        ? signed.uploadUrl
        : signed.uploadUrl + (signed.uploadUrl.includes('?') ? '&' : '?') + `token=${encodeURIComponent(signed.token)}`;

      // Step 3 — upload direct to Supabase Storage via multipart/form-data.
      // Uses XHR (not fetch) so we get real progress events for a nice UX.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('x-upsert', 'true');
        // NOTE: do NOT set Content-Type — the browser must set it to
        // `multipart/form-data; boundary=...` automatically for FormData.

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText.slice(0, 300)}`));
        };
        xhr.onerror = () => reject(new Error('Network error during upload — check your internet connection or CORS / firewall settings.'));
        xhr.ontimeout = () => reject(new Error('Upload timed out.'));

        const form = new FormData();
        form.append('cacheControl', '3600');
        form.append('', file, file.name);
        xhr.send(form);
      });

      return {
        publicUrl: signed.publicUrl,
        path: signed.path,
        bucket,
        contentType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      };
    },
  });
}
