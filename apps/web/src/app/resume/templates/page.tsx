'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  Crown,
  Eye,
  FileText,
  Loader2,
  Lock,
  Palette,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import {
  useBuyResumeTemplate,
  useResumeTemplates,
  useSelectResumeTemplate,
  useVerifyResumeTemplate,
} from '@/hooks/use-resume-templates';
import { useI18n } from '@/i18n';
import { formatEtb } from '@/lib/utils';
import type { ResumeTemplateId } from '@apex-work/shared';

export default function ResumeTemplatesPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const { isLoading: meLoading, isAuthed } = useMe();
  const templates = useResumeTemplates();
  const select = useSelectResumeTemplate();
  const buy = useBuyResumeTemplate();
  const verify = useVerifyResumeTemplate();
  const processedPurchase = useRef<string | null>(null);
  const purchaseId = params.get('purchase');
  const purchaseTemplate = params.get('template') as ResumeTemplateId | null;

  useEffect(() => {
    if (!meLoading && !isAuthed) router.replace('/login?next=/resume/templates');
  }, [isAuthed, meLoading, router]);

  useEffect(() => {
    if (!purchaseId || !purchaseTemplate || processedPurchase.current === purchaseId || !isAuthed)
      return;
    processedPurchase.current = purchaseId;
    verify.mutate(
      { templateId: purchaseTemplate, purchaseId },
      {
        onSuccess: (result) => {
          toast[result.owned ? 'success' : 'error'](
            result.owned
              ? 'Template unlocked. You can use it now.'
              : 'Payment is still processing. Try Verify again in a moment.',
          );
          router.replace('/resume/templates');
        },
        onError: (error) => {
          toast.error(error.message);
          router.replace('/resume/templates');
        },
      },
    );
  }, [isAuthed, purchaseId, purchaseTemplate, router, verify]);

  if (meLoading || templates.isLoading || !isAuthed) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const items = templates.data?.templates ?? [];
  const busy = select.isPending || buy.isPending || verify.isPending;

  const choose = (id: ResumeTemplateId, owned: boolean) => {
    if (busy) return;
    if (owned) {
      select.mutate(id, {
        onSuccess: () => toast.success('Template applied to your resume'),
        onError: (error) => toast.error(error.message),
      });
      return;
    }
    buy.mutate(id, {
      onSuccess: ({ checkoutUrl }) => {
        if (checkoutUrl) window.location.assign(checkoutUrl);
        else toast.success('Template is already unlocked');
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <div className="min-h-dvh bg-background pb-12">
      <header className="safe-top sticky top-0 z-10 border-b border-border bg-background/90 px-3 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label={t('common.back')}
            className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h1 className="text-lg font-extrabold tracking-tight">Apex Resume Studio</h1>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Templates, ATS-ready exports and an AI career coach
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/resume">
              <FileText className="h-4 w-4" /> Builder
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 py-6 sm:px-6">
        <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8">
          <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative max-w-2xl">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
              <Crown className="h-3 w-3" /> Career toolkit
            </span>
            <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-4xl">
              Make a CV that gets understood in seconds.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Choose a proven layout, tailor it for every opportunity, let Apex Coach find gaps,
              then export a polished PDF for Ethiopia or international applications.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild variant="brand">
                <Link href="/resume">
                  <Sparkles className="h-4 w-4" /> Open builder
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/resume/preview">
                  <Eye className="h-4 w-4" /> Preview current CV
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <div className="mt-7 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">Template marketplace</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Free templates stay free forever. Pro templates are a one-time purchase in ETB.
            </p>
          </div>
          {busy && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((template) => (
            <article
              key={template.id}
              className={`group flex flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-lg ${!template.available ? 'opacity-60 grayscale' : ''} ${template.active ? 'border-primary shadow-md shadow-primary/10' : 'border-border'}`}
            >
              <div className="relative flex h-32 items-center justify-center overflow-hidden bg-gradient-to-br from-primary/10 via-card to-primary/5">
                <div className="absolute inset-x-5 top-5 h-2 rounded-full bg-foreground/10" />
                <div className="absolute inset-x-8 top-10 space-y-2">
                  <div className="h-1.5 w-3/4 rounded-full bg-foreground/10" />
                  <div className="h-1.5 w-1/2 rounded-full bg-foreground/10" />
                  <div className="mt-4 h-1.5 w-full rounded-full bg-primary/30" />
                  <div className="h-1.5 w-5/6 rounded-full bg-foreground/10" />
                </div>
                <span className="relative z-10 mt-20 text-2xl font-black text-primary/80">
                  {template.emoji}
                </span>
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-[10px] font-bold shadow-sm">
                  {template.tier === 'pro' ? (
                    <>
                      <Crown className="h-3 w-3 text-amber-500" /> Pro
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" /> Free
                    </>
                  )}
                </span>
                {!template.available ? (
                  <span className="absolute bottom-2 left-2 rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">
                    Temporarily unavailable
                  </span>
                ) : template.active ? (
                  <span className="absolute bottom-2 left-2 rounded-full bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground">
                    Current
                  </span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-extrabold">{template.name}</h3>
                <p className="mt-1 min-h-10 text-xs leading-relaxed text-muted-foreground">
                  {template.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {template.features.map((feature) => (
                    <span
                      key={feature}
                      className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
                <div className="mt-auto pt-4">
                  <p className="mb-2 text-[10px] text-muted-foreground">
                    Best for {template.bestFor}
                  </p>
                  <Button
                    className="w-full"
                    variant={template.owned ? 'outline' : 'brand'}
                    size="sm"
                    disabled={busy || !template.available}
                    onClick={() => choose(template.id, template.owned)}
                  >
                    {!template.available ? (
                      'Unavailable'
                    ) : template.owned ? (
                      <>
                        <Check className="h-4 w-4" /> {template.active ? 'Applied' : 'Use template'}
                      </>
                    ) : (
                      <>
                        <Lock className="h-3.5 w-3.5" /> Unlock {formatEtb(template.priceEtb)}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <StudioFeature
            icon={<WalletCards className="h-5 w-5" />}
            title="One-time pricing"
            body="Pay once through Chapa. No monthly subscription is required to keep an unlocked template."
          />
          <StudioFeature
            icon={<Palette className="h-5 w-5" />}
            title="Four export modes"
            body="A4, US Letter, one-page and portfolio PDF formats from the same saved content."
          />
          <StudioFeature
            icon={<Sparkles className="h-5 w-5" />}
            title="AI career coach"
            body="Get honest gaps, role keywords, bullet rewrites and case-study help without inventing facts."
          />
        </section>
      </main>
    </div>
  );
}

function StudioFeature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mt-3 text-sm font-extrabold">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
