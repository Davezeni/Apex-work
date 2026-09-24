'use client';

import { dt } from '@/i18n/auto';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  FileSignature,
  PenLine,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { safeBack } from '@/lib/safe-back';
const tools = [
  {
    href: '/ai/proposal',
    icon: PenLine,
    color: 'bg-violet-500/15 text-violet-400',
    title: 'AI Proposal Writer',
    description: 'Turn a job description into a clear, confident proposal that sounds like you.',
    action: 'Write a proposal',
  },
  {
    href: '/ai/brief',
    icon: BriefcaseBusiness,
    color: 'bg-emerald-500/15 text-emerald-400',
    title: 'AI Brief Generator',
    description:
      'Describe your project in plain language and get a structured job post with skills and budget.',
    action: 'Create a brief',
  },
  {
    href: '/ai/contract',
    icon: FileSignature,
    color: 'bg-amber-500/15 text-amber-400',
    title: 'Contract Generator',
    description:
      'Create a simple service agreement with scope, delivery, payment, and revision terms.',
    action: 'Generate a contract',
  },
];

export default function AIToolsPage() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="min-h-dvh bg-background pb-20 md:mx-auto md:max-w-5xl">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => safeBack(router)}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">{dt('AI tools')}</h1>
          <p className="text-[11px] text-muted-foreground">
            {dt('Work faster. Communicate clearly. Win more work.')}
          </p>
        </div>
      </header>

      <section className="relative mx-3 mt-4 overflow-hidden rounded-3xl border border-primary/30 bg-primary/10 p-5">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold">{dt('Your built-in work assistant')}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Start with a sentence or paste a job post. Each tool gives you an editable result
              before anything is sent or published.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-3 mt-6 space-y-3">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg active:scale-[.99]"
            >
              <div
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tool.color}`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold">{tool.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {tool.description}
                </p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary">
                  {tool.action}{' '}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </section>

      <div className="mx-3 mt-6 rounded-2xl border border-border bg-card p-4 text-center">
        <p className="text-xs text-muted-foreground">{dt('Need to hire instead?')}</p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href="/jobs/new">{dt('Post a job')}</Link>
        </Button>
      </div>
    </div>
  );
}
