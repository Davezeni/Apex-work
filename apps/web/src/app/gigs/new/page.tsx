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
  ImagePlus,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RichEditor } from '@/components/ui/rich-editor';
import { useMe } from '@/hooks/use-me';
import { useCreateGig } from '@/hooks/use-gig-mutations';
import { CATEGORIES, MIN_GIG_PRICE_ETB, MAX_GIG_PRICE_ETB } from '@apex-work/shared';
import Image from 'next/image';
import { cn, formatEtb } from '@/lib/utils';
import { useUpload } from '@/hooks/use-upload';
import { useI18n } from '@/i18n';
import { dt } from '@/i18n/auto';
import { safeBack } from '@/lib/safe-back';

type Step = 'overview' | 'setup' | 'review';
const STEPS: Step[] = ['overview', 'setup', 'review'];

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
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const upload = useUpload();

  useEffect(() => {
    if (isLoading) return;
    if (!isSignedIn) router.replace('/login?next=/gigs/new');
    else if (me && me.role !== 'FREELANCER') {
      toast.error(t('postGig.onlyFreelancers'));
      router.replace('/');
    } else if (me && (!me.phone || !me.isPhoneVerified)) {
      router.replace('/settings/phone?next=/gigs/new');
    } else if (me && !me.isOnboarded) {
      router.replace('/onboarding');
    }
  }, [isLoading, isSignedIn, me, router, t]);

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

  // Count PLAIN text length so an empty <p></p> from the rich editor doesn't
  // accidentally satisfy the min-length check.
  const descPlainLen = description.replace(/<[^>]+>/g, '').trim().length;
  const canGoNext =
    (step === 'overview' &&
      title.trim().length >= 15 &&
      !!categoryId &&
      descPlainLen >= 50) ||
    (step === 'setup' &&
      packages.length >= 1 &&
      packages.every(
        (p) =>
          p.title.trim().length >= 3 &&
          p.description.trim().length >= 10 &&
          p.priceEtb >= MIN_GIG_PRICE_ETB &&
          p.priceEtb <= MAX_GIG_PRICE_ETB &&
          p.deliveryDays >= 1 &&
          p.deliveryDays <= 90,
      )) ||
    step === 'review';

  const goNext = () => {
    if (!canGoNext) return;
    if (stepIdx < STEPS.length - 1) setStepIdx((i) => i + 1);
    else void submit();
  };

  const goBack = () => {
    if (stepIdx > 0) setStepIdx((i) => i - 1);
    else safeBack(router, '/browse');
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
        coverImageUrl: coverUrl || undefined,
        galleryUrls: gallery,
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
    const nextTier: Tier = packages.length === 1 ? 'STANDARD' : 'PREMIUM';
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

  const uploadImage = async (file: File, done: (url: string) => void) => {
    if (file.size > 10 * 1024 * 1024) return toast.error(dt('Max 10 MB per image'));
    if (!file.type.startsWith('image/')) return toast.error(dt('Images only (JPG, PNG, WebP)'));
    try {
      const res = await upload.mutateAsync({ file, bucket: 'portfolio' });
      done(res.publicUrl);
    } catch (err) {
      toast.error((err as Error).message || dt('Upload failed — check your connection'));
    }
  };

  const minPrice = Math.min(...packages.map((p) => p.priceEtb));
  const activeCat = CATEGORIES.find((c) => c.id === categoryId);

  if (isLoading || !me) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mesh-bg flex min-h-dvh flex-col">
      <header className="safe-top mx-auto flex w-full max-w-md items-center gap-3 p-5 md:max-w-2xl">
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

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-10 md:mb-10 md:w-[calc(100%-4rem)] md:max-w-2xl md:rounded-3xl md:border md:border-border md:bg-card md:p-8 md:shadow-sm">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
          >
            {step === 'overview' && (
              <>
                <StepIcon icon={<Sparkles className="h-6 w-6" />} />
                <h1 className="text-3xl font-extrabold tracking-tight">{dt('Gig overview')}</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {dt('A clear title, the right category and a solid description get you found.')}
                </p>
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
                  {t('postGig.titleMax', { count: title.length })}
                </p>
              </>
            )}

            {step === 'overview' && (
              <>

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
                  {t('postGig.tagsLabel')}
                </label>
                <input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder={t('postGig.tagsPlaceholder')}
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

            {step === 'overview' && (
              <>
                <RichEditor
                  value={description}
                  onChange={setDescription}
                  placeholder={t('postGig.descPlaceholder')}
                  className="mt-6"
                  minRows={10}
                  maxChars={5000}
                />
              </>
            )}

            {step === 'setup' && (
              <>
                <StepIcon icon={<ImagePlus className="h-6 w-6" />} />
                <h1 className="text-3xl font-extrabold tracking-tight">{dt('Photos & pricing')}</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {dt(
                    'Gigs with a cover photo get up to 3× more orders. You can also skip this step.',
                  )}
                </p>

                <div className="mt-6">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {dt('Cover photo')}
                  </label>
                  {coverUrl ? (
                    <div className="relative overflow-hidden rounded-2xl border border-border">
                      <Image
                        src={coverUrl}
                        alt={dt('Cover preview')}
                        width={800}
                        height={450}
                        unoptimized
                        className="aspect-video w-full object-cover"
                      />
                      <button
                        onClick={() => setCoverUrl(null)}
                        aria-label={t('common.delete')}
                        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card py-10 text-center transition-colors hover:border-primary/50 hover:bg-primary/5">
                      {upload.isPending ? (
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      ) : (
                        <ImagePlus className="h-6 w-6 text-muted-foreground" />
                      )}
                      <span className="text-sm font-semibold">
                        {upload.isPending ? dt('Uploading…') : dt('Tap to choose a cover image')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {dt('JPG or PNG, up to 10 MB')}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) void uploadImage(f, setCoverUrl);
                        }}
                      />
                    </label>
                  )}
                </div>

                <div className="mt-5">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {dt('Gallery (optional)')}
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {gallery.map((url) => (
                      <div
                        key={url}
                        className="relative aspect-square overflow-hidden rounded-xl border border-border"
                      >
                        <Image
                          src={url}
                          alt={dt('Gallery image')}
                          fill
                          unoptimized
                          sizes="150px"
                          className="object-cover"
                        />
                        <button
                          onClick={() => setGallery(gallery.filter((u) => u !== url))}
                          aria-label={t('common.delete')}
                          className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {gallery.length < 4 && (
                      <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border bg-card transition-colors hover:border-primary/50">
                        {upload.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : (
                          <Plus className="h-5 w-5 text-muted-foreground" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (f) void uploadImage(f, (u) => setGallery((g2) => [...g2, u]));
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </>
            )}

            {step === 'setup' && (
              <>

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
                    {packages.length === 1 ? t('postGig.addStandard') : t('postGig.addPremium')}
                  </button>
                )}
              </>
            )}
            {step === 'review' && (
              <>
                <StepIcon icon={<Eye className="h-6 w-6" />} />
                <h1 className="text-3xl font-extrabold tracking-tight">{dt('Review & publish')}</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {dt('This is exactly how buyers will see your gig in the feed.')}
                </p>

                <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-primary/25 via-fuchsia-500/15 to-cyan-400/20">
                    {coverUrl ? (
                      <Image
                        src={coverUrl}
                        alt={dt('Cover preview')}
                        fill
                        unoptimized
                        sizes="600px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-4xl">
                        {activeCat?.icon ?? '✨'}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="line-clamp-2 text-sm font-semibold leading-tight">
                      {title.trim()}
                    </div>
                    {tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <div className="grad-hero grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold text-white">
                          {(me.fullName[0] ?? '?').toUpperCase()}
                        </div>
                        <span className="font-semibold text-foreground">
                          {me.fullName.split(' ')[0]}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] text-muted-foreground">{t('gig.from')}</div>
                        <div className="text-sm font-extrabold text-primary">
                          {formatEtb(minPrice)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-border bg-card p-3">
                  {packages.map((p) => (
                    <div
                      key={p.tier}
                      className="flex items-center justify-between border-b border-border py-1.5 text-xs last:border-0"
                    >
                      <span className="font-semibold">
                        {p.tier === 'BASIC'
                          ? dt('Basic')
                          : p.tier === 'STANDARD'
                            ? dt('Standard')
                            : dt('Premium')}
                      </span>
                      <span className="text-muted-foreground">
                        {p.deliveryDays}
                        {dt('d')} · {formatEtb(p.priceEtb)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-start gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {dt(
                    'Tip: gigs with complete packages and a clear description rank higher in search.',
                  )}
                </div>
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
        {!canGoNext && step === 'setup' && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {dt(
              'Each package needs a name (3+ characters), a description (10+ characters), a price of 100–500,000 ETB and delivery of 1–90 days.',
            )}
          </p>
        )}
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
            aria-label={t('postGig.removePackage')}
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
        {t('postGig.priceHint')}{' '}
        <span className="font-semibold text-foreground">{formatEtb(pkg.priceEtb)}</span>
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
