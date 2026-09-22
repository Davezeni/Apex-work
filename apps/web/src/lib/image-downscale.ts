/**
 * Client-side image downscale — the single biggest performance fix for media.
 *
 * Why: phones shoot 3-8 MB photos. Before this, those bytes went to storage
 * (or into the Postgres-backed avatar gateway) and every <img> in the app then
 * downloaded the full original. Now images are resized in the browser with
 * canvas before upload: avatars become ~30-60 KB at 512px, other images cap at
 * 1600px — visually identical in the UI, 20-100x lighter on the wire.
 *
 * Non-images and files that fail to decode (rare codec issues) pass through
 * untouched so upload flows can never be broken by this.
 */

const TYPE_CAPS: Record<string, { maxDim: number; quality: number }> = {
  // keep module-level simple: bucket logic lives in downscaleForBucket
};

async function decode(file: File): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
  });
}

export async function downscaleImage(file: File, maxDim: number, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/gif') return file; // animation would be lost
  // Small enough already — leave untouched (keeps PNG transparency, etc.).
  const SMALL = 220 * 1024;
  if (file.size <= SMALL) return file;

  const bitmap = await decode(file);
  if (!bitmap) return file;
  try {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1 && file.size <= SMALL * 2) return file; // decent size already
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, quality);
    if (!blob || blob.size >= file.size) return file; // never make it bigger
    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  } finally {
    bitmap.close?.();
  }
}

/** Bucket-aware wrapper used by the upload hook. */
export async function downscaleForBucket(file: File, bucket: string): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (bucket === 'avatars') return downscaleImage(file, 512, 0.82);
  return downscaleImage(file, 1600, 0.82);
}
