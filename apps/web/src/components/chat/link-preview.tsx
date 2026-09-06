'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Link2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export interface LinkPreviewData {
  url: string;
  domain: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

/** Module-level cache so the same link isn't re-unfurled for every message. */
const cache = new Map<string, LinkPreviewData>();

/** Pull the first http(s) URL out of a message body. */
export function firstUrlIn(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"')\]]+/i);
  if (!m) return null;
  // Tidy a trailing punctuation char that isn't part of the URL.
  return m[0].replace(/[.,!?;:]+$/, '');
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function LinkPreview({ url, isMine }: { url: string; isMine?: boolean }) {
  const token = useAuthStore((s) => s.accessToken);
  const [data, setData] = useState<LinkPreviewData | null>(cache.get(url) ?? null);
  const [imgOk, setImgOk] = useState(true);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (cache.has(url)) return;
    if (inFlight.current) return;
    inFlight.current = true;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 6000);
    apiFetch<LinkPreviewData>(`/conversations/unfurl?url=${encodeURIComponent(url)}`, { token })
      .then((d) => {
        cache.set(url, d);
        setData(d);
      })
      .catch(() => setFailed(true))
      .finally(() => {
        clearTimeout(timer);
        inFlight.current = false;
      });
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [url, token]);

  // Avoid a layout jump while we only know the domain.
  const title = useMemo(() => data?.title ?? url, [data, url]);
  const domain = data?.domain ?? domainOf(url);
  const desc = data?.description?.trim();
  const image = data?.image && imgOk ? data.image : null;

  if (failed && !data) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      onClick={(e) => e.stopPropagation()}
      className={cnCard(isMine, image)}
    >
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          loading="lazy"
          onError={() => setImgOk(false)}
          className="h-32 w-full object-cover"
        />
      )}
      <div className={cnContent(isMine)}>
        <div className={cnDomain(isMine)}>
          <Link2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{domain}</span>
          <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 opacity-70" />
        </div>
        <div className={cnTitle(isMine)}>{title}</div>
        {desc && <div className={cnDesc(isMine)}>{desc}</div>}
      </div>
    </a>
  );
}

function cnCard(isMine: boolean | undefined, image: string | null): string {
  return [
    'my-1 block w-[280px] max-w-full overflow-hidden rounded-xl border text-left no-underline transition-transform active:scale-[.99]',
    image ? '' : 'my-2',
    isMine ? 'border-white/25 bg-white/10' : 'border-border bg-background/60',
  ].join(' ');
}
function cnContent(isMine: boolean | undefined): string {
  return isMine ? 'px-3 py-2' : 'px-3 py-2';
}
function cnDomain(isMine: boolean | undefined): string {
  return [
    'flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide',
    isMine ? 'text-white/70' : 'text-muted-foreground',
  ].join(' ');
}
function cnTitle(isMine: boolean | undefined): string {
  return [
    'mt-0.5 line-clamp-2 text-[13px] font-semibold leading-tight',
    isMine ? 'text-white' : 'text-foreground',
  ].join(' ');
}
function cnDesc(isMine: boolean | undefined): string {
  return [
    'mt-1 line-clamp-2 text-[11px] leading-snug',
    isMine ? 'text-white/70' : 'text-muted-foreground',
  ].join(' ');
}
