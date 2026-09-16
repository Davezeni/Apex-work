'use client';

import { dt } from '@/i18n/auto';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Cookie,
  FileQuestion,
  FileText,
  Loader2,
  Mail,
  ScrollText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useContentPage } from '@/hooks/use-content-page';
import { Markdown } from '@/components/markdown';
import { safeBack } from '@/lib/safe-back';

/** Per-slug hero art so every policy page feels designed, not dumped. */
const META: Record<string, { icon: React.ReactNode; eyebrow: string; blurb: string }> = {
  privacy: {
    icon: <ShieldCheck className="h-4 w-4" />,
    eyebrow: 'Privacy policy',
    blurb: 'What we collect, why we collect it, and the control you keep.',
  },
  terms: {
    icon: <ScrollText className="h-4 w-4" />,
    eyebrow: 'Terms & conditions',
    blurb: 'The simple rules that keep ApexWork fair for everyone.',
  },
  cookies: {
    icon: <Cookie className="h-4 w-4" />,
    eyebrow: 'Cookies',
    blurb: 'The tiny files that keep you signed in — and nothing sneaky.',
  },
  faq: {
    icon: <FileQuestion className="h-4 w-4" />,
    eyebrow: 'FAQ',
    blurb: 'Quick answers to the questions we hear most.',
  },
  contact: {
    icon: <Mail className="h-4 w-4" />,
    eyebrow: 'Contact us',
    blurb: 'Real humans in Addis Ababa — reach out any time.',
  },
};

function metaFor(slug: string) {
  return (
    META[slug] ?? {
      icon: <FileText className="h-4 w-4" />,
      eyebrow: 'ApexWork',
      blurb: '',
    }
  );
}

/**
 * Shared renderer for admin-editable site content pages (privacy, terms,
 * cookies, FAQ…). Fetches the latest curated text and renders it inside a
 * designed hero + card layout; falls back gracefully while loading.
 */
export function ContentPage({ slug, fallbackTitle }: { slug: string; fallbackTitle: string }) {
  const router = useRouter();
  const { data, isLoading } = useContentPage(slug, fallbackTitle);
  const title = data?.title || fallbackTitle;
  const markdown = data?.markdown || '';
  const meta = metaFor(slug);

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => safeBack(router)}
          aria-label={dt('Back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{title}</h1>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4">
        <section className="grad-hero relative mt-4 overflow-hidden rounded-3xl p-6 text-white shadow-xl shadow-primary/30 sm:p-9">
          <div className="absolute -right-16 -top-20 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur">
            <Sparkles className="h-3 w-3" /> {dt(meta.eyebrow)}
          </span>
          <h2 className="mt-3 text-2xl font-black leading-tight tracking-tight sm:text-3xl">
            {title}
          </h2>
          {meta.blurb && (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/90">{dt(meta.blurb)}</p>
          )}
        </section>

        <section className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8">
          {isLoading ? (
            <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-muted-foreground" />
          ) : markdown ? (
            <div className="text-sm leading-relaxed [&_a]:font-semibold [&_a]:text-primary [&_h1]:mt-6 [&_h1]:text-xl [&_h1]:font-black [&_h2]:mt-6 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-1.5 [&_h2]:text-lg [&_h2]:font-extrabold [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-extrabold [&_li]:mt-1 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_p]:mt-3 [&_strong]:font-extrabold [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
              <Markdown>{markdown}</Markdown>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {dt('This page is being prepared.')}
            </p>
          )}
          <div className="mt-6 flex items-center justify-center gap-1.5 border-t border-border pt-4 text-[11px] text-muted-foreground">
            {meta.icon}
            {dt('Last updated by the ApexWork team')}
          </div>
        </section>
      </main>
    </div>
  );
}
