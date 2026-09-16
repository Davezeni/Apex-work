'use client';

import { dt } from '@/i18n/auto';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  FileText,
  Handshake,
  Lock,
  MessageSquare,
  PenLine,
  Rocket,
  Search,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { useContentPage } from '@/hooks/use-content-page';
import { Markdown } from '@/components/markdown';

const CLIENT_STEPS = [
  {
    icon: <Search className="h-4 w-4" />,
    title: 'Find or post',
    body: 'Browse ready-made services or post a job and collect proposals.',
  },
  {
    icon: <Lock className="h-4 w-4" />,
    title: 'Pay into escrow',
    body: 'Check out with Chapa. Your money is held safely — not sent yet.',
  },
  {
    icon: <FileText className="h-4 w-4" />,
    title: 'Review the delivery',
    body: 'Get the work in your order workspace. Accept it or request changes.',
  },
  {
    icon: <Star className="h-4 w-4" />,
    title: 'Release & rate',
    body: 'Funds go to the freelancer, and your rating helps everyone.',
  },
] as const;

const FREELANCER_STEPS = [
  {
    icon: <PenLine className="h-4 w-4" />,
    title: 'Build your profile',
    body: 'Skills, a professional CV and trust badges make clients trust you.',
  },
  {
    icon: <MessageSquare className="h-4 w-4" />,
    title: 'Win the work',
    body: 'Send proposals, agree on milestones and chat with auto-translate.',
  },
  {
    icon: <Rocket className="h-4 w-4" />,
    title: 'Deliver',
    body: 'Upload the finished work and mark the order delivered.',
  },
  {
    icon: <Banknote className="h-4 w-4" />,
    title: 'Get paid',
    body: 'Funds release on approval — or automatically after 7 days. Withdraw to telebirr or bank.',
  },
] as const;

function StepList({
  label,
  steps,
}: {
  label: string;
  steps: readonly { icon: React.ReactNode; title: string; body: string }[];
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-primary">
        <Handshake className="h-4 w-4" /> {label}
      </h3>
      <ol className="mt-4 space-y-4">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-black text-primary">
                {i + 1}
              </div>
              {i < steps.length - 1 && <div className="mt-1 w-px flex-1 bg-border" />}
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-1.5 text-sm font-extrabold">
                <span className="text-primary">{s.icon}</span>
                {dt(s.title)}
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{dt(s.body)}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function HowItWorksPage() {
  const router = useRouter();
  const { data, isLoading } = useContentPage('how-it-works', 'How it works');
  const markdown = data?.markdown?.trim() ?? '';

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
        <h1 className="text-lg font-extrabold tracking-tight">{data?.title ?? 'How it works'}</h1>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4">
        {/* Hero */}
        <section className="grad-hero relative mt-4 overflow-hidden rounded-3xl p-6 text-white shadow-xl shadow-primary/30 sm:p-10">
          <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur">
            <ShieldCheck className="h-3 w-3" /> {dt('Escrow-protected')}
          </span>
          <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
            {dt('From handshake to payout, in four steps.')}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/90">
            {dt(
              'Every order follows the same safe path: money is paid upfront, held in escrow, and only released when the work is accepted.',
            )}
          </p>
        </section>

        {/* Escrow strip */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-center gap-2 text-center sm:gap-4">
            {[
              { icon: <Banknote className="h-4 w-4" />, label: 'Client pays' },
              { icon: <Lock className="h-4 w-4" />, label: 'Held in escrow' },
              { icon: <CheckCircle2 className="h-4 w-4" />, label: 'Released on approval' },
            ].map((s, i) => (
              <div key={s.label} className="flex items-center gap-2 sm:gap-4">
                <div className="flex flex-col items-center gap-1">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
                    {s.icon}
                  </div>
                  <span className="text-[9px] font-bold leading-tight text-muted-foreground sm:text-[10px]">
                    {dt(s.label)}
                  </span>
                </div>
                {i < 2 && <div className="h-0.5 w-8 rounded bg-border sm:w-16" />}
              </div>
            ))}
          </div>
        </section>

        {/* Steps for both roles */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <StepList label={dt('For clients')} steps={CLIENT_STEPS} />
          <StepList label={dt('For freelancers')} steps={FREELANCER_STEPS} />
        </section>

        {/* Safety notes */}
        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: <ShieldCheck className="h-4 w-4" />,
              title: 'Dispute? A human reviews it',
              body: 'Open a dispute and an admin rules within 48 hours — funds stay locked until then.',
            },
            {
              icon: <BadgeCheck className="h-4 w-4" />,
              title: 'Silent client? Auto-release',
              body: 'If the client does not respond, delivered work is paid automatically after 7 days.',
            },
            {
              icon: <Banknote className="h-4 w-4" />,
              title: 'No subscription',
              body: 'Posting is free. A small, transparent fee is taken only when you get paid.',
            },
          ].map((n) => (
            <div key={n.title} className="rounded-2xl border border-border bg-card p-4">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                {n.icon}
              </div>
              <h4 className="mt-2.5 text-sm font-extrabold">{dt(n.title)}</h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{dt(n.body)}</p>
            </div>
          ))}
        </section>

        {/* Editable extra content (admin-managed markdown) */}
        {markdown && (
          <section className="mt-8 rounded-2xl border border-border bg-card p-5">
            {isLoading ? null : <Markdown>{markdown}</Markdown>}
          </section>
        )}
      </main>
    </div>
  );
}
