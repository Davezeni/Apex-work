'use client';

import { dt } from '@/i18n/auto';
import { useRouter } from 'next/navigation';
import { ArrowLeft, HelpCircle, Mail, MessageCircle, Phone, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/i18n';
import { useContentPage } from '@/hooks/use-content-page';
import { useSiteConfig } from '@/hooks/use-site-config';
import { Markdown } from '@/components/markdown';
export default function HelpPage() {
  const router = useRouter();
  const { t } = useI18n();
  const faq = useContentPage('faq', 'Frequently asked');
  const site = useSiteConfig();

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{t('settings.help')}</h1>
      </header>

      <section className="mx-3 mt-4 grid grid-cols-3 gap-2">
        <a
          href={`mailto:${site.data?.supportEmail}`}
          className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 active:scale-95"
        >
          <Mail className="h-5 w-5 text-primary" />
          <span className="text-[11px] font-semibold">{dt('Email')}</span>
        </a>
        <a
          href={site.data?.supportTelegram}
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 active:scale-95"
        >
          <MessageCircle className="h-5 w-5 text-primary" />
          <span className="text-[11px] font-semibold">{dt('Telegram')}</span>
        </a>
        <a
          href={`tel:${site.data?.supportPhone}`}
          className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 active:scale-95"
        >
          <Phone className="h-5 w-5 text-primary" />
          <span className="text-[11px] font-semibold">{dt('Call')}</span>
        </a>
      </section>

      <section className="mx-3 mt-5">
        <h2 className="mb-2 px-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <HelpCircle className="mr-1 inline h-3 w-3" /> Frequently asked
        </h2>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card px-4 py-2">
          {faq.isLoading ? (
            <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" />
          ) : faq.data?.markdown ? (
            <Markdown>{faq.data.markdown}</Markdown>
          ) : (
            <div className="flex flex-col gap-3 py-4">
              <p className="text-sm font-semibold">{dt('How do I get paid on Apex-Work?')}</p>
              <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">
                When a client releases funds from escrow, we credit your wallet within minutes. From
                there you can withdraw to Telebirr, CBE Birr, or your bank.
              </p>
              <p className="text-sm font-semibold">{dt('What is the platform fee?')}</p>
              <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">
                We take 10% of every completed order — half of what Fiverr and Upwork charge. No
                monthly fees.
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="mx-3 mt-6 text-center">
        <Link href="/settings/legal" className="text-xs font-semibold text-primary">
          Terms & Privacy →
        </Link>
      </div>
    </div>
  );
}
