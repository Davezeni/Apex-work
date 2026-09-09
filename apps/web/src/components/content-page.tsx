'use client';

import { dt } from '@/i18n/auto';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useContentPage } from '@/hooks/use-content-page';
import { Markdown } from '@/components/markdown';
/**
 * Shared renderer for admin-editable site content pages (privacy, terms,
 * cookies, FAQ). Fetches the latest curated text and renders it as Markdown;
 * falls back gracefully to a blank body while loading or on error.
 */
export function ContentPage({ slug, fallbackTitle }: { slug: string; fallbackTitle: string }) {
  const router = useRouter();
  const { data, isLoading } = useContentPage(slug, fallbackTitle);
  const title = data?.title || fallbackTitle;
  const markdown = data?.markdown || '';

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          aria-label={dt('Back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{title}</h1>
      </header>
      <article className="mx-4 mt-4">
        {isLoading ? (
          <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-muted-foreground" />
        ) : markdown ? (
          <Markdown>{markdown}</Markdown>
        ) : (
          <p className="text-sm text-muted-foreground">{dt('This page is being prepared.')}</p>
        )}
      </article>
    </div>
  );
}
