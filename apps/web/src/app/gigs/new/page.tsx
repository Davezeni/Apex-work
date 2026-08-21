'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Sparkles,
  Layers,
  FileText,
  Wallet,
  Check,
  Plus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import { useCreateGig } from '@/hooks/use-gig-mutations';
import { CATEGORIES, MIN_GIG_PRICE_ETB, MAX_GIG_PRICE_ETB } from '@apex-work/shared';
import { cn, formatEtb } from '@/lib/utils';
import { useI18n } from '@/i18n';

type Step = 'title' | 'category' | 'description' | 'pricing';
const STEPS: Step[] = ['title', 'category', 'description', 'pricing'];

type Tier = 'BASIC' | 'STANDARD' | 'PREMIUM';
interface PackageDraft {
  tier: Tier;
  title: string;
  description: string;
  priceEtb: number;
  deliveryDays: number;
  revisions: number;
}

const DEFAULT_PACKAGES: PackageDraft[] = [
  { tier: 'BASIC', title: '', description: '', priceEtb: 1000, deliveryDays: 3, revisions: 1 },
];

export default function PostGigPage() {
  const router = useRouter();
  const { data: me, isLoading, isSignedIn } = useMe();
  const { t } = useI18n();
  const create = useCreateGig();

  const [stepIdx, setStepIdx] = useState(0);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string>('development');
  const [tagsInput, setTagsInput] = useState('');
  const [description, setDescription] = useState('');
  const [packages, setPackages] = useState<PackageDraft[]>(DEFAULT_PACKAGES);

  useEffect(() => {
    if (isLoading) return;
    if (!isSignedIn) router.replace('/login?next=/gigs/new');
    else if (me && me.role !== 'FREELANCER') {
      toast.error('Only freelancers can post gigs.');
      router.replace('/');
    } else if (me && !me.isOnboarded) {
      router.replace('/onboarding');
    }
  }, [isLoading, isSignedIn, me, router]);

  const step = STEPS[stepIdx]!;
  const tags = useMemo(
    () =>
      Array.from(
        new Set(
          tagsInput
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t.length > 0 && t.length <= 30),
        ),
      ).slice(0, 8),
    [tagsInput],
  );

  const canGoNext =
    (step === 'title' && title.trim().length >= 15) ||
    (step === 'category' && !!categoryId) ||
    (step === 'description' && description.trim().length >= 50) ||
    (step === 'pricing' &&
      packages.length >= 1 &&
      packages.every(
        (p) =>
          p.title.trim().length >= 3 &&
          p.description.trim().length >= 10 &&
          p.priceEtb >= MIN_GIG_PRICE_ETB &&
          p.priceEtb <= MAX_GIG_PRICE_ETB &&
          p.deliveryDays >= 1 &&
          p.deliveryDays <= 90,
      ));

  const goNext = () => {
    if (!canGoNext) return;
    if (stepIdx < STEPS.length - 1) setStepIdx((i) => i + 1);
    else void submit();
  };

  const goBack = () => {
    if (stepIdx > 0) setStepIdx((i) => i - 1);
    else router.back();
  };

  const submit = async () => {
    try {
      const created = await create.mutateAsync({
        title: title.trim(),
        categoryId,
        tags,
        description: description.trim(),
        packages: packages.map((p) => ({
          tier: p.tier,
          title: p.title.trim(),
          description: p.description.trim(),
          priceEtb: p.priceEtb,
          deliveryDays: p.deliveryDays,
          revisions: p.revisions,
        })),
        galleryUrls: [],
      });
      toast.success(t('postGig.success'));
      router.push(`/gigs/${created.slug}`);
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? t('postGig.publishFailed'));
    }
  };

  const addPackage = () => {
    if (packages.length >= 3) return;
    const nextTier: Tier =
      packages.length === 1 ? 'STANDARD' : 'PREMIUM';
    const lastPrice = packages[packages.length - 1]?.priceEtb ?? 1000;
    setPackages([
      ...packages,
      {
        tier: nextTier,
        title: '',
        description: '',
        priceEtb: lastPrice * 2,
        deliveryDays: 5,
        revisions: 3,
      },
    ]);
  };

  const removePackage = (idx: number) => {
    if (packages.length <= 1) return;
    setPackages(packages.filter((_, i) => i !== idx));
  };

  const updatePackage = (idx: number, patch: Partial<PackageDraft>) => {
    setPackages(packages.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  if (isLoading || !me) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mesh-bg flex min-h-dvh flex-col">
      <header className="safe-top flex items-center gap-3 p-5">
        <button
          onClick={goBack}
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"
          aria-label={t('common.back')}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-1 gap-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                i <= stepIdx ? 'bg-primary' : 'bg-border',
              )}
            />
          ))}
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {stepIdx + 1}/{STEPS.length}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
            className="flex-1"
          >
            {step === 'title' && (
              <>
                <StepIcon icon={<Sparkles className="h-6 w-6" />} />
                <h1 className="text-3xl font-extrabold tracking-tight">{t('postGig.step1')}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{t('postGig.step1Blurb')}</p>
                <textarea
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  rows={3}
                  maxLength={120}
                  placeholder={t('postGig.gigTitlePlaceholder')}
                  className="mt-6 min-h-[92px] w-full resize-none rounded-2xl border border-border bg-card p-4 text-lg font-medium leading-snug outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
                />
                <p className="mt-2 text-right text-[11px] text-muted-foreground">
                  {title.length}/120 · min 15
                </p>
              </>
            )}

            {step === 'category' && (
              <>
                <StepIcon icon={<Layers className="h-6 w-6" />} />
                <h1 className="text-3xl font-extrabold tracking-tight">{t('postGig.step2')}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{t('postGig.step2Blurb')}</p>

                <div className="mt-6 grid grid-cols-2 gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCategoryId(c.id)}
                      className={cn(
                        'rounded-2xl border p-4 text-left transition-all active:scale-95',
                        categoryId === c.id
                          ? 'border-primary bg-primary/10 shadow-md shadow-primary/20'
                          : 'border-border bg-card',
                      )}
                    >
                      <div className="text-2xl">{c.icon}</div>
                      <div className="mt-2 text-sm font-semibold">{c.label}</div>
                    </button>
                  ))}
                </div>

                <label className="mt-6 block text-xs font-semibold text-muted-foreground">
                  Tags (comma-separated, up to 8)
                </label>
                <input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g. figma, saas, landing, ui"
                  className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
                />
                {tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}

            {step === 'description' && (
              <>
                <StepIcon icon={<FileText className="h-6 w-6" />} />
                <h1 className="text-3xl font-extrabold tracking-tight">{t('postGig.step3')}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{t('postGig.step3Blurb')}</p>
                <textarea
                  autoFocus
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={10}
                  maxLength={5000}
                  placeholder="I design conversion-focused landing pages for SaaS startups…"
                  className="mt-6 min-h-[240px] w-full resize-none rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
                />
                <p className="mt-2 text-right text-[11px] text-muted-foreground">
                  {description.length}/5000 · min 50
                </p>
              </>
            )}

            {step === 'pricing' && (
              <>
                <StepIcon icon={<Wallet className="h-6 w-6" />} />
                <h1 className="text-3xl font-extrabold tracking-tight">{t('postGig.step4')}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{t('postGig.step4Blurb')}</p>

                <div className="mt-6 space-y-4">
                  {packages.map((p, i) => (
                    <PackageCard
                      key={p.tier}
                      pkg={p}
                      onChange={(patch) => updatePackage(i, patch)}
                      onRemove={packages.length > 1 ? () => removePackage(i) : undefined}
                      t={t}
                    />
                  ))}
                </div>

                {packages.length < 3 && (
                  <button
                    onClick={addPackage}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
                  >
                    <Plus className="h-4 w-4" strokeWidth={3} />
                    Add {packages.length === 1 ? 'Standard' : 'Premium'} package
                  </button>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <Button
          variant="brand"
          size="lg"
          className="mt-6 w-full"
          onClick={goNext}
          disabled={!canGoNext || create.isPending}
        >
          {create.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : stepIdx === STEPS.length - 1 ? (
            <>
              <Check className="h-4 w-4" /> {t('postGig.publish')}
            </>
          ) : (
            <>
              {t('common.continue')} <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </main>
    </div>
  );
}

function StepIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="grad-hero mb-6 grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lg shadow-primary/40">
      {icon}
    </div>
  );
}

function PackageCard({
  pkg,
  onChange,
  onRemove,
  t,
}: {
  pkg: PackageDraft;
  onChange: (patch: Partial<PackageDraft>) => void;
  onRemove?: () => void;
  t: (k: string) => string;
}) {
  const tierLabel = {
    BASIC: t('postGig.packageBasic'),
    STANDARD: t('postGig.packageStandard'),
    PREMIUM: t('postGig.packagePremium'),
  }[pkg.tier];

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="grad-hero rounded-full px-3 py-1 text-xs font-bold text-white">
          {tierLabel}
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            aria-label="Remove package"
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-destructive active:scale-90"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <input
        value={pkg.title}
        onChange={(e) => onChange({ title: e.target.value })}
        maxLength={60}
        placeholder={t('postGig.packageTitle')}
        className="mt-3 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary"
      />
      <textarea
        value={pkg.description}
        onChange={(e) => onChange({ description: e.target.value })}
        rows={2}
        maxLength={500}
        placeholder={t('postGig.packageDesc')}
        className="mt-2 min-h-[60px] w-full resize-none rounded-xl border border-border bg-background p-3 text-xs outline-none focus:border-primary"
      />

      <div className="mt-3 grid grid-cols-3 gap-2">
        <NumberField
          label={t('postGig.price')}
          value={pkg.priceEtb}
          onChange={(v) => onChange({ priceEtb: v })}
          min={MIN_GIG_PRICE_ETB}
          max={MAX_GIG_PRICE_ETB}
          step={100}
        />
        <NumberField
          label={t('postGig.deliveryDays')}
          value={pkg.deliveryDays}
          onChange={(v) => onChange({ deliveryDays: v })}
          min={1}
          max={90}
        />
        <NumberField
          label={t('postGig.revisions')}
          value={pkg.revisions}
          onChange={(v) => onChange({ revisions: v })}
          min={0}
          max={20}
        />
      </div>

      <div className="mt-3 text-right text-xs text-muted-foreground">
        Price: <span className="font-semibold text-foreground">{formatEtb(pkg.priceEtb)}</span>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, Math.round(n))));
        }}
        min={min}
        max={max}
        step={step}
        className="h-10 rounded-xl border border-border bg-background px-2 text-sm font-semibold outline-none focus:border-primary"
      />
    </label>
  );
}
