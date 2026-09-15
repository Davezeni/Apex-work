'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  X,
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
import {
  ResumeSampleThumb,
  ResumeTemplate,
  SAMPLE_RESUME,
} from '@/components/resume/resume-document';
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
  const [previewId, setPreviewId] = useState<string | null>(null);
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
  const previewTemplate = items.find((item) => item.id === previewId) ?? null;

  const choose = (id: ResumeTemplateId, owned: boolean) => {
    if (busy) return;
    if (owned) {
      select.mutate(id, {
        onSuccess: () => toast.success(dt('Template applied to your resume')),
        onError: (error) => toast.error(error.message),
      });
      return;
    }
    buy.mutate(id, {
      onSuccess: ({ checkoutUrl }) => {
        if (checkoutUrl) window.location.assign(checkoutUrl);
        else toast.success(dt('Template is already unlocked'));
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
              <h1 className="text-lg font-extrabold tracking-tight">{dt('Apex Resume Studio')}</h1>
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
            <h2 className="text-xl font-extrabold tracking-tight">{dt('Template marketplace')}</h2>
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
              {/* LIVE sample preview — the real template renderer with sample
                  data, scaled down. Tap to inspect before buying. */}
              <button
                type="button"
                onClick={() => setPreviewId(template.id)}
                disabled={!template.available}
                aria-label={dt('Preview with sample data')}
                className="relative block h-44 w-full overflow-hidden bg-neutral-200"
              >
                <ResumeSampleThumb
                  templateId={template.id}
                  scale={0.3}
                  className="absolute left-1/2 top-2 -translate-x-1/2"
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-3 pb-2 pt-6 text-left text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {dt('Tap to preview')}
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
              </button>
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
            title={dt('One-time pricing')}
            body="Pay once through Chapa. No monthly subscription is required to keep an unlocked template."
          />
          <StudioFeature
            icon={<Palette className="h-5 w-5" />}
            title={dt('Four export modes')}
            body="A4, US Letter, one-page and portfolio PDF formats from the same saved content."
          />
          <StudioFeature
            icon={<Sparkles className="h-5 w-5" />}
            title={dt('AI career coach')}
            body="Get honest gaps, role keywords, bullet rewrites and case-study help without inventing facts."
          />
        </section>
      </main>

      {/* Full-size sample preview sheet (see the template before buying) */}
      {previewTemplate && (
        <div
          className="fixed inset-0 z-[90] flex items-stretch justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setPreviewId(null)}
          role="dialog"
          aria-label={`${previewTemplate.name} — ${dt('Preview with sample data')}`}
        >
          <div
            className="relative flex w-full max-w-2xl flex-col bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="safe-top flex items-center gap-2 border-b border-border bg-background px-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-extrabold">{previewTemplate.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {dt('Sample content — your CV data will replace this')}
                </div>
              </div>
              <Button
                size="sm"
                variant="brand"
                disabled={busy || !previewTemplate.available}
                onClick={() => {
                  setPreviewId(null);
                  choose(previewTemplate.id, previewTemplate.owned);
                }}
              >
                {previewTemplate.owned ? (
                  <>{previewTemplate.active ? 'Applied' : dt('Use this template')}</>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" /> Unlock {formatEtb(previewTemplate.priceEtb)}
                  </>
                )}
              </Button>
              <button
                onClick={() => setPreviewId(null)}
                aria-label={t('common.back')}
                className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-neutral-200 p-3 sm:p-6">
              <div className="mx-auto w-full max-w-xl bg-white p-6 text-black shadow-xl sm:p-9">
                <ResumeTemplate
                  templateId={previewTemplate.id}
                  resume={SAMPLE_RESUME}
                  name="Hanna Getachew"
                />
              </div>
            </div>
          </div>
        </div>
      )}
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
