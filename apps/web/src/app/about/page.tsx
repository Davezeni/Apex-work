'use client';

import { dt } from '@/i18n/auto';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  FileText,
  Gift,
  Languages,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useContentPage } from '@/hooks/use-content-page';
import { Markdown } from '@/components/markdown';
import { safeBack } from '@/lib/safe-back';

const VALUES = [
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: 'Escrow on every order',
    body: 'The client pays upfront and the money is held safely — it only releases when the work is accepted.',
  },
  {
    icon: <Languages className="h-5 w-5" />,
    title: 'Speaks your language',
    body: 'English, Amharic, Afaan Oromo and Tigrinya across the whole app — chat included.',
  },
  {
    icon: <BadgeCheck className="h-5 w-5" />,
    title: 'Verified people',
    body: 'Phone-verified accounts, trust badges for top freelancers and public reviews on every gig.',
  },
  {
    icon: <Wallet className="h-5 w-5" />,
    title: 'Money you can see',
    body: 'Wallet balance, escrow status and an exact fee breakdown on every single order.',
  },
] as const;

const DO_CARDS = [
  {
    icon: <Briefcase className="h-5 w-5" />,
    title: 'Hire for anything',
    body: 'Browse ready-made services or post a job and receive proposals — from design to data entry.',
    href: '/browse',
    cta: 'Browse services',
  },
  {
    icon: <FileText className="h-5 w-5" />,
    title: 'Get hired',
    body: 'Build a profile you are proud of, publish a professional CV and let your work speak.',
    href: '/onboarding',
    cta: 'Start earning',
  },
  {
    icon: <Gift className="h-5 w-5" />,
    title: 'Grow with us',
    body: 'Earn trust badges, climb the stats, and get 100 ETB for every friend you refer.',
    href: '/referrals',
    cta: 'Refer friends',
  },
] as const;

export default function AboutPage() {
  const router = useRouter();
  const { data, isLoading } = useContentPage('about', 'About us');
  const markdown = data?.markdown?.trim() ?? '';

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
        <h1 className="text-lg font-extrabold tracking-tight">{data?.title ?? 'About us'}</h1>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4">
        {/* Hero */}
        <section className="grad-hero relative mt-4 overflow-hidden rounded-3xl p-6 text-white shadow-xl shadow-primary/30 sm:p-10">
          <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur">
            <Sparkles className="h-3 w-3" /> {dt('Made in Ethiopia')}
          </span>
          <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
            {dt('Work meets trust.')}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/90 sm:text-base">
            {dt(
              'ApexWork connects Ethiopian clients with vetted freelancers — escrow-protected payments, chat that translates itself, and fees you can count on one hand.',
            )}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/browse"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-extrabold text-primary shadow-md transition-transform active:scale-95"
            >
              {dt('Browse services')} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-xs font-extrabold text-white backdrop-blur transition-transform active:scale-95"
            >
              {dt('How it works')} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

        {/* Values */}
        <section className="mt-8">
          <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
            {dt('Why ApexWork')}
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {VALUES.map((v) => (
              <div
                key={v.title}
                className="rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  {v.icon}
                </div>
                <h4 className="mt-3 text-sm font-extrabold">{dt(v.title)}</h4>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{dt(v.body)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What you can do */}
        <section className="mt-8">
          <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
            {dt('What you can do here')}
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {DO_CARDS.map((c) => (
              <Link
                key={c.title}
                href={c.href}
                className="group rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  {c.icon}
                </div>
                <h4 className="mt-3 text-sm font-extrabold">{dt(c.title)}</h4>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{dt(c.body)}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-extrabold text-primary">
                  {dt(c.cta)}
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Editable team note (admin-managed markdown) */}
        <section className="mt-8">
          <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
            {dt('From the team')}
          </h3>
          <div className="mt-3 rounded-2xl border border-border bg-card p-5">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{dt('Loading…')}</p>
            ) : markdown ? (
              <Markdown>{markdown}</Markdown>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {dt(
                  'We are a small team in Addis Ababa building the place where Ethiopian talent meets opportunity — fair fees, real protection and software that speaks like us.',
                )}
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
