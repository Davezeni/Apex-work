/**
 * Custom Next/Image loader that rewrites Supabase public storage URLs
 * through Supabase's built-in image transformation endpoint.
 *
 *   Input:  https://xxx.supabase.co/storage/v1/object/public/portfolio/foo.png
 *   Output: https://xxx.supabase.co/storage/v1/render/image/public/portfolio/foo.png?width=640&quality=70
 *
 * Effect: hero images that were 2MB PNGs come down as ~40KB WebP/AVIF
 * auto-negotiated to viewport size. Massive LCP/CLS win, zero code change
 * at call sites — we set `loader` on <Image>.
 *
 * URLs that aren't Supabase pass through unchanged (unsplash, etc).
 */
export function supabaseLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  // Non-Supabase: pass through.
  if (!/supabase\.co\/storage\/v1\/object\/public\//.test(src)) {
    return src;
  }
  const transformed = src.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/',
  );
  const q = quality ?? 75;
  const u = new URL(transformed);
  u.searchParams.set('width', String(width));
  u.searchParams.set('quality', String(q));
  // resize=contain keeps aspect ratio; format is auto (webp / avif).
  u.searchParams.set('resize', 'contain');
  return u.toString();
}
