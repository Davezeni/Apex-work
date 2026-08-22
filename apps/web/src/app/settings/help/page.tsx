'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, HelpCircle, Mail, MessageCircle, Phone, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/i18n';

const FAQS = [
  { q: 'How do I get paid on Apex-Work?', a: 'When a client releases funds from escrow, we credit your wallet within minutes. From there you can withdraw to Telebirr, CBE Birr, or your bank.' },
  { q: 'What is the platform fee?', a: 'We take 10% of every completed order — half of what Fiverr and Upwork charge. No monthly fees, no listing fees.' },
  { q: 'How long do withdrawals take?', a: 'Telebirr / CBE Birr payouts arrive within a few hours on business days. Bank transfers usually take 1-2 business days.' },
  { q: 'What if there is a dispute?', a: 'Funds stay in escrow until the client accepts delivery. If a dispute happens, contact support — we mediate within 48 hours.' },
  { q: 'Can I use Apex-Work in Amharic?', a: 'Yes. Tap Settings → Language and pick አማርኛ. The whole app translates instantly.' },
  { q: 'How do I verify my ID?', a: 'Go to Profile → Security → Verify identity. Upload your Kebele ID or passport — usually approved in a few hours.' },
];

export default function HelpPage() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} aria-label={t('common.back')} className="grid h-9 w-9 place-items-center rounded-full active:scale-90">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{t('settings.help')}</h1>
      </header>

      <section className="mx-3 mt-4 grid grid-cols-3 gap-2">
        <a href="mailto:support@apex-work.com" className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 active:scale-95">
          <Mail className="h-5 w-5 text-primary" />
          <span className="text-[11px] font-semibold">Email</span>
        </a>
        <a href="https://t.me/apex_work_support" target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 active:scale-95">
          <MessageCircle className="h-5 w-5 text-primary" />
          <span className="text-[11px] font-semibold">Telegram</span>
        </a>
        <a href="tel:+251911000000" className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 active:scale-95">
          <Phone className="h-5 w-5 text-primary" />
          <span className="text-[11px] font-semibold">Call</span>
        </a>
      </section>

      <section className="mx-3 mt-5">
        <h2 className="mb-2 px-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <HelpCircle className="mr-1 inline h-3 w-3" /> Frequently asked
        </h2>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {FAQS.map((f, i) => (
            <details key={i} className="group">
              <summary className="flex cursor-pointer items-center gap-3 px-4 py-3.5 text-sm font-semibold marker:hidden">
                {f.q}
                <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
              </summary>
              <p className="px-4 pb-4 text-xs leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
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
