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

      // Step 2 — upload direct to Supabase Storage.
      // Uses XHR (not fetch) so we get real progress events for a nice UX.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', signed.uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        // Supabase signed URLs accept either query-param OR header for token
        // (we're using the URL variant that already includes it), but sending
        // the header is harmless and covers both cases.
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(file);
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
