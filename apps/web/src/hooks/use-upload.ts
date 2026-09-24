'use client';

import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { downscaleForBucket } from '@/lib/image-downscale';
import type { UploadBucket } from '@apex-work/shared';
import { contentTypeForFile } from '@/lib/file-types';

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

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
  contentType?: string;
  sizeBytes?: number;
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function signedUrlWithToken(uploadUrl: string, token: string): string {
  const url = new URL(uploadUrl, API_URL);
  if (!url.searchParams.has('token')) url.searchParams.set('token', token);
  return url.toString();
}

function xhrUpload({
  url,
  method,
  body,
  headers,
  onProgress,
}: {
  url: string;
  method: 'PUT' | 'POST';
  body: Blob | FormData;
  headers?: Record<string, string>;
  onProgress?: (pct: number) => void;
}): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    // Large files should not be killed while a Render free-tier instance is
    // waking up. The browser still reports a normal network error if the
    // connection disappears.
    xhr.timeout = 180_000;
    for (const [key, value] of Object.entries(headers ?? {})) xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timed out. Please try again.'));
    xhr.onabort = () => reject(new Error('Upload was cancelled.'));
    xhr.send(body);
  });
}

async function uploadDirect(
  signed: SignResponse,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const uploadUrl = signedUrlWithToken(signed.uploadUrl, signed.token);
  // Supabase Storage's signed-upload protocol expects a FormData body for a
  // browser Blob. Do not set Content-Type manually: XHR adds the multipart
  // boundary. Setting it to the file MIME is the common cause of a 400/CORS
  // failure here.
  const form = new FormData();
  // Uploaded media (avatars/portfolio) never changes at the same key —
  // cache for a year at the CDN edge instead of revalidating every hour.
  form.append('cacheControl', '31536000');
  form.append('', file, file.name);

  const result = await xhrUpload({
    url: uploadUrl,
    method: 'PUT',
    body: form,
    headers: { 'x-upsert': 'false' },
    onProgress,
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Direct storage upload failed (${result.status})`);
  }
}

async function uploadThroughApi(
  file: File,
  bucket: UploadBucket,
  token: string | null,
  contentType: string,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  if (!token) throw new Error('Please sign in before uploading a file.');

  const query = new URLSearchParams({ bucket, filename: file.name });
  const result = await xhrUpload({
    url: `${API_URL}/v1/uploads/proxy?${query.toString()}`,
    method: 'PUT',
    body: file,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
    },
    onProgress,
  });

  let json: unknown;
  try {
    json = JSON.parse(result.text);
  } catch {
    throw new Error(`Upload gateway returned an invalid response (${result.status}).`);
  }
  const body = json as {
    ok?: boolean;
    data?: Partial<UploadResult>;
    error?: { message?: string };
  };
  if (result.status < 200 || result.status >= 300 || !body.ok || !body.data?.publicUrl) {
    throw new Error(body.error?.message || `Upload failed (${result.status}).`);
  }

  return {
    publicUrl: body.data.publicUrl,
    path: body.data.path ?? '',
    bucket,
    contentType: body.data.contentType ?? contentType,
    sizeBytes: body.data.sizeBytes ?? file.size,
  };
}

/**
 * Upload a file to Supabase Storage through a resilient two-path flow:
 *
 *   1) Ask our API to mint a short-lived signed URL and upload directly to
 *      Supabase using its browser FormData protocol.
 *   2) If signing or the cross-origin PUT fails, send the raw bytes to our
 *      authenticated `/uploads/proxy` gateway. This is the important mobile
 *      fallback: it avoids Supabase CORS, captive portals, and in-app browser
 *      restrictions without requiring a temporary file on Render.
 *
 * Returns the public URL to persist alongside the domain object
 * (portfolio item, message attachment, avatar, review photo, or job brief).
 */
export function useUpload() {
  const token = useAuthStore((s) => s.accessToken);

  return useMutation<
    UploadResult,
    Error,
    { file: File; bucket: UploadBucket; onProgress?: (pct: number) => void }
  >({
    mutationFn: async ({ file, bucket, onProgress }) => {
      // Resize big phone photos in the browser BEFORE anything hits the wire —
      // avatars land in the file gateway (Postgres-backed) and everything else
      // goes to Supabase, so smaller bytes = faster loads everywhere.
      file = await downscaleForBucket(file, bucket);
      const contentType = contentTypeForFile(file);
      // Avatars now go through the SAME signed Supabase path as everything else:
      // Supabase's CDN serves them, so profile pictures never wake or load
      // through the free-tier API. Safety net below: if the avatars bucket is
      // not public in Supabase yet (dashboard toggle), the public URL fails the
      // HEAD check and we transparently fall back to the Postgres-backed
      // gateway (uploadThroughApi). Old gateway URLs keep working forever.
      const avatarsViaSupabase = bucket === 'avatars';
      let signed: SignResponse | null = null;
      let firstError: Error | null = null;

      try {
        signed = await apiFetch<SignResponse>('/uploads/sign', {
          method: 'POST',
          token,
          body: {
            bucket,
            filename: file.name,
            contentType,
            sizeBytes: file.size,
          },
        });
      } catch (error) {
        firstError = asError(error);
      }

      if (signed) {
        try {
          await uploadDirect(signed, file, onProgress);
          // Avatars: only trust the Supabase public URL if it is actually
          // publicly readable (bucket must be toggled public in the Supabase
          // dashboard). A private bucket returns 400 on object/public/.
          if (avatarsViaSupabase) {
            const head = await fetch(signed.publicUrl, { method: 'HEAD' }).catch(() => null);
            if (!head || !head.ok) {
              return await uploadThroughApi(file, bucket, token, contentType, onProgress);
            }
          }
          return {
            publicUrl: signed.publicUrl,
            path: signed.path,
            bucket,
            contentType: signed.contentType ?? contentType,
            sizeBytes: signed.sizeBytes ?? file.size,
          };
        } catch (error) {
          // This is expected on some mobile/in-app browsers. Continue to the
          // same-origin API fallback rather than showing a false CORS toast.
          firstError = asError(error);
        }
      }

      try {
        return await uploadThroughApi(file, bucket, token, contentType, onProgress);
      } catch (error) {
        const fallbackError = asError(error);
        if (firstError && firstError.message !== fallbackError.message) {
          throw new Error(`${fallbackError.message} (${firstError.message})`);
        }
        throw fallbackError;
      }
    },
  });
}
