'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Sparkles,
  MapPin,
  Wallet,
  Wrench,
  Plus,
  X,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useMe } from '@/hooks/use-me';
import { useSkills, useCreateSkill, type Skill } from '@/hooks/use-skills';
import { cn, formatEtb } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/i18n';

type Step = 'title' | 'bio' | 'location' | 'rate' | 'skills';
const STEPS: Step[] = ['title', 'bio', 'location', 'rate', 'skills'];

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.accessToken);
  const { data: me, isLoading } = useMe();
  const { t } = useI18n();
  const [stepIdx, setStepIdx] = useState(0);
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [rate, setRate] = useState<number>(500);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Redirect if not logged in or already onboarded.
    if (!isLoading && !me) router.replace('/login');
    if (!isLoading && me?.isOnboarded) router.replace('/profile');
    if (!isLoading && me && me.role !== 'FREELANCER') router.replace('/');
  }, [isLoading, me, router]);

  const step = STEPS[stepIdx]!;
  const canGoNext =
    (step === 'title' && title.trim().length >= 5) ||
    (step === 'bio' && bio.trim().length >= 30) ||
    (step === 'location' && city.trim().length >= 2) ||
    (step === 'rate' && rate >= 50) ||
    (step === 'skills' && selectedSkillIds.size >= 1);

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
    setSaving(true);
    try {
      await apiFetch('/onboarding/freelancer', {
        method: 'POST',
        token,
        body: {
          title: title.trim(),
          bio: bio.trim(),
          city: city.trim(),
          hourlyRateEtb: rate,
          skillIds: Array.from(selectedSkillIds),
        },
      });
      // Invalidate the `me` query so the profile immediately reflects the update.
      await qc.invalidateQueries({ queryKey: ['me'] });
      toast.success(t('onboarding.welcomeDone'));
      router.push('/profile');
    } catch (err) {
      const e = err as ApiError;
      toast.error(e.message ?? t('onboarding.saveFailed'));
    } finally {
      setSaving(false);
    }
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
      {/* Header + progress */}
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
                <StepTitle>{t('onboarding.titleStep')}</StepTitle>
                <StepBlurb>{t('onboarding.titleBlurb')}</StepBlurb>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('onboarding.titlePlaceholder')}
                  maxLength={120}
                  className="mt-8 h-14 w-full rounded-2xl border border-border bg-card px-4 text-base font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
                />
                <p className="mt-2 text-right text-[11px] text-muted-foreground">
                  {title.length}/120
                </p>
              </>
            )}

            {step === 'bio' && (
              <>
                <StepIcon icon={<Wrench className="h-6 w-6" />} />
                <StepTitle>{t('onboarding.bioStep')}</StepTitle>
                <StepBlurb>{t('onboarding.bioBlurb')}</StepBlurb>
                <textarea
                  autoFocus
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={6}
                  maxLength={2000}
                  placeholder={t('onboarding.bioPlaceholder')}
                  className="mt-8 min-h-[160px] w-full resize-none rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
                />
                <p className="mt-2 text-right text-[11px] text-muted-foreground">
                  {bio.length}/2000
                </p>
              </>
            )}

            {step === 'location' && (
              <>
                <StepIcon icon={<MapPin className="h-6 w-6" />} />
                <StepTitle>{t('onboarding.locationStep')}</StepTitle>
                <StepBlurb>{t('onboarding.locationBlurb')}</StepBlurb>
                <input
                  autoFocus
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t('onboarding.cityPlaceholder')}
                  className="mt-8 h-14 w-full rounded-2xl border border-border bg-card px-4 text-base font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {['Addis Ababa', 'Bahir Dar', 'Hawassa', 'Mekelle', 'Dire Dawa'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setCity(c)}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 'rate' && (
              <>
                <StepIcon icon={<Wallet className="h-6 w-6" />} />
                <StepTitle>{t('onboarding.rateStep')}</StepTitle>
                <StepBlurb>{t('onboarding.rateBlurb')}</StepBlurb>
                <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-center">
                  <div className="grad-text text-5xl font-extrabold tracking-tight">
                    {formatEtb(rate)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t('onboarding.perHour')}
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={5000}
                    step={50}
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                    className="mt-6 w-full accent-primary"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>{formatEtb(50)}</span>
                    <span>{formatEtb(5000)}</span>
                  </div>
                </div>
              </>
            )}

            {step === 'skills' && (
              <SkillsPicker selected={selectedSkillIds} onChange={setSelectedSkillIds} />
            )}
          </motion.div>
        </AnimatePresence>

        <Button
          variant="brand"
          size="lg"
          className="mt-6 w-full"
          onClick={goNext}
          disabled={!canGoNext || saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : stepIdx === STEPS.length - 1 ? (
            t('onboarding.finishSetup')
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
function StepTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="text-3xl font-extrabold tracking-tight">{children}</h1>;
}
function StepBlurb({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm text-muted-foreground">{children}</p>;
}

/**
 * Maximum total skills a freelancer can pick. The catalog is only a starting
 * point; custom skills can be created from the same search field.
 */
// Keep the curated picker generous while allowing freelancers to add custom
// skills that are not in the catalog. The API enforces the same total.
const MAX_SKILLS = 40;

/**
 * Client-side dedupe check — same rule as server slugify().
 * Used to decide whether "Add 'X' as new skill" should appear.
 */
function normalizeForCompare(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

function SkillsPicker({
  selected,
  onChange,
}: {
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  const { t } = useI18n();
  // Live search input, debounced for the API query key.
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 200);
    return () => clearTimeout(timer);
  }, [q]);

  // Skills we've already resolved (via search or creation) — used to render
  // the selected-chip row even when the search query changes.
  const [known, setKnown] = useState<Map<string, Skill>>(new Map());
  const { data, isLoading } = useSkills(debouncedQ);
  const createSkill = useCreateSkill();

  // As results come in, remember them so selected chips can render forever
  // (search results narrow to nothing if the user changes q, but the chips
  // above still need names).
  useEffect(() => {
    if (!data?.items) return;
    setKnown((prev) => {
      const next = new Map(prev);
      for (const s of data.items) next.set(s.id, s);
      return next;
    });
  }, [data]);

  const selectedSkills = Array.from(selected)
    .map((id) => known.get(id))
    .filter((s): s is Skill => !!s);

  const toggle = (id: string, skill?: Skill) => {
    if (skill) {
      // Remember it so we can render the chip when it's selected but not in current results
      setKnown((prev) => {
        if (prev.has(id)) return prev;
        const next = new Map(prev);
        next.set(id, skill);
        return next;
      });
    }
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < MAX_SKILLS) next.add(id);
    onChange(next);
  };

  const trimmedQ = q.trim();
  const qKey = normalizeForCompare(trimmedQ);
  const results = data?.items ?? [];
  const hasExactMatch = results.some((s) => normalizeForCompare(s.name) === qKey);
  // Show "Add as new" when the user typed something meaningful that isn't in results.
  const canCreate =
    trimmedQ.length >= 2 && qKey.length >= 2 && !hasExactMatch && !createSkill.isPending;

  const handleCreate = async () => {
    if (!canCreate) return;
    if (selected.size >= MAX_SKILLS) {
      toast.error(t('onboarding.selectedCount', { count: selected.size, max: MAX_SKILLS }));
      return;
    }
    try {
      const { skill, created } = await createSkill.mutateAsync(trimmedQ);
      toggle(skill.id, skill);
      setQ('');
      if (created) toast.success(t('onboarding.addAsNew', { name: skill.name }));
    } catch (err) {
      toast.error((err as ApiError).message ?? t('onboarding.saveFailed'));
    }
  };

  return (
    <>
      <StepIcon icon={<Wrench className="h-6 w-6" />} />
      <StepTitle>{t('onboarding.skillsStep')}</StepTitle>
      <StepBlurb>{t('onboarding.skillsBlurb', { max: MAX_SKILLS })}</StepBlurb>

      {/* Selected chips — always visible so users see their picks */}
      {selectedSkills.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2 rounded-2xl border border-primary/40 bg-primary/5 p-3">
          {selectedSkills.map((s) => (
            <button
              key={s.id}
              onClick={() => toggle(s.id, s)}
              className="grad-hero inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-primary/40 transition-transform active:scale-95"
              aria-label={`Remove ${s.name}`}
            >
              {s.name}
              <X className="h-3 w-3 opacity-80" strokeWidth={3} />
            </button>
          ))}
        </div>
      )}

      {/* Search input with inline Enter-to-create */}
      <div className="mt-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canCreate) {
              e.preventDefault();
              void handleCreate();
            }
          }}
          placeholder={t('onboarding.searchSkills')}
          maxLength={40}
          className="h-12 flex-1 rounded-xl border border-border bg-card px-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
        />
        {canCreate && (
          <button
            onClick={handleCreate}
            disabled={createSkill.isPending}
            aria-label={t('onboarding.addAsNew', { name: trimmedQ })}
            className="grad-hero grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white shadow-md shadow-primary/40 transition-transform active:scale-95 disabled:opacity-60"
          >
            {createSkill.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Plus className="h-5 w-5" strokeWidth={3} />
            )}
          </button>
        )}
      </div>

      {/* "Add 'foo' as new skill" hint row when there's no exact match */}
      {canCreate && (
        <button
          onClick={handleCreate}
          disabled={createSkill.isPending}
          className="mt-2 flex w-full items-center gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-primary/10 disabled:opacity-60"
        >
          <div className="grad-hero grid h-8 w-8 shrink-0 place-items-center rounded-full text-white">
            <Plus className="h-4 w-4" strokeWidth={3} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">
              {t('onboarding.addAsNew', { name: trimmedQ })}
            </div>
            <div className="text-[11px] text-muted-foreground">{t('onboarding.addAsNewSub')}</div>
          </div>
        </button>
      )}

      {/* Results grid */}
      <div className="mt-3 flex min-h-[60px] flex-wrap gap-2">
        {isLoading && (
          <div className="grid h-16 w-full place-items-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {!isLoading &&
          results.map((s) => {
            const active = selected.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id, s)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all active:scale-95',
                  active
                    ? 'grad-hero border-transparent text-white shadow-md shadow-primary/40'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40',
                )}
              >
                {active && <Check className="h-3 w-3" strokeWidth={3} />}
                {s.name}
              </button>
            );
          })}
        {!isLoading && !canCreate && results.length === 0 && trimmedQ.length === 0 && (
          <p className="w-full py-4 text-center text-xs text-muted-foreground">
            {t('onboarding.startTyping')}
          </p>
        )}
      </div>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        {t('onboarding.selectedCount', { count: selected.size, max: MAX_SKILLS })}
      </p>
    </>
  );
}
