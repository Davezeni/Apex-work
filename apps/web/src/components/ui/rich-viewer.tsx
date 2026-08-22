'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

/**
 * Render TipTap-produced HTML safely.
 *
 * We already sanitize at write time (TipTap's schema only permits a small
 * whitelist), but defense-in-depth: strip <script>, on* handlers, and
 * javascript: URLs before setting innerHTML. Everything else — <p>, <a>,
 * <ul>, headings, code — is fine.
 *
 * Legacy plain-text values (from before the editor swap) render fine too
 * because they don't contain any HTML tags to worry about.
 */
export function RichViewer({ html, className }: { html: string | null | undefined; className?: string }) {
  const clean = useMemo(() => sanitize(html ?? ''), [html]);
  if (!clean) return null;
  // If the string has NO HTML tags, render as pre-wrap text so line-breaks survive.
  if (!/<[a-z][\s\S]*>/i.test(clean)) {
    return <p className={cn('whitespace-pre-wrap', className)}>{clean}</p>;
  }
  return (
    <div
      className={cn('prose prose-invert prose-sm max-w-none leading-relaxed', className)}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

function sanitize(html: string): string {
  return html
    // strip <script>…</script>
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    // strip <style>…</style>
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // strip inline event handlers (onclick, onerror, …)
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // neutralize javascript: URIs
    .replace(/javascript:/gi, '')
    // neutralize data: URIs on href/src (but keep image data URIs? No — safer to strip)
    .replace(/(href|src)\s*=\s*(["'])\s*data:/gi, '$1=$2about:blank" data-blocked="1');
}
