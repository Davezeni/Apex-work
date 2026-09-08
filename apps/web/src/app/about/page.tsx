'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useContentPage } from '@/hooks/use-content-page';
import { Markdown } from '@/components/markdown';

export default function AboutPage() {
  const router = useRouter();
  const { data, isLoading } = useContentPage('about', 'About us');
  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{data?.title ?? 'About us'}</h1>
      </header>
      <article className="mx-4 mt-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Markdown>{data?.markdown ?? ''}</Markdown>
        )}
      </article>
    </div>
  );
}
