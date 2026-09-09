'use client';

import { dt } from '@/i18n/auto';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, MessageCircle, Phone, ExternalLink } from 'lucide-react';
import { useContentPage } from '@/hooks/use-content-page';
import { useSiteConfig } from '@/hooks/use-site-config';
import { Markdown } from '@/components/markdown';
export default function ContactPage() {
  const router = useRouter();
  const { data: page, isLoading } = useContentPage('contact', 'Contact us');
  const { data: site } = useSiteConfig();

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
        <h1 className="text-lg font-extrabold tracking-tight">{page?.title ?? 'Contact us'}</h1>
      </header>

      {/* Live contact channels from the admin-managed site config */}
      <section className="mx-4 mt-4 grid grid-cols-3 gap-2">
        <a
          href={`mailto:${site?.supportEmail}`}
          className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4"
        >
          <Mail className="h-5 w-5 text-primary" />
          <span className="text-[11px] font-semibold">{dt('Email')}</span>
        </a>
        <a
          href={site?.supportTelegram}
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4"
        >
          <MessageCircle className="h-5 w-5 text-primary" />
          <span className="text-[11px] font-semibold">{dt('Telegram')}</span>
        </a>
        <a
          href={`tel:${site?.supportPhone}`}
          className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4"
        >
          <Phone className="h-5 w-5 text-primary" />
          <span className="text-[11px] font-semibold">{dt('Call')}</span>
        </a>
      </section>

      <article className="mx-4 mt-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Markdown>{page?.markdown ?? ''}</Markdown>
        )}
      </article>

      <p className="mx-4 mt-6 flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
        <ExternalLink className="h-3 w-3" /> Open a ticket from{' '}
        <span className="font-semibold">{dt('Help')}</span> for account or order issues.
      </p>
    </div>
  );
}
