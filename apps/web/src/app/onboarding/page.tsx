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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useMe } from '@/hooks/use-me';
import { useSkills, type Skill } from '@/hooks/use-skills';
import { cn, formatEtb } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

type Step = 'title' | 'bio' | 'location' | 'rate' | 'skills';
const STEPS: Step[] = ['title', 'bio', 'location', 'rate', 'skills'];

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.accessToken);
  const { data: me, isLoading } = useMe();
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
      toast.success('Profile set up! Welcome to Apex-Work 🎉');
      router.push('/profile');
    } catch (err) {
      const e = err as ApiError;
      toast.error(e.message ?? 'Could not save. Try again.');
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
          aria-label="Back"
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
                <StepTitle>What do you do?</StepTitle>
                <StepBlurb>Your professional headline. Clients see this first.</StepBlurb>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Senior UI/UX Designer"
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
                <StepTitle>Tell your story</StepTitle>
                <StepBlurb>
                  A short bio showing your experience and what makes you great.
                </StepBlurb>
                <textarea
                  autoFocus
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={6}
                  maxLength={2000}
                  placeholder="I'm a product designer with 5 years of experience helping startups turn ideas into beautiful, usable products..."
                  className="mt-8 min-h-[160px] w-full resize-none rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
                />
                <p className="mt-2 text-right text-[11px] text-muted-foreground">
                  {bio.length}/2000 · minimum 30
                </p>
              </>
            )}

            {step === 'location' && (
              <>
                <StepIcon icon={<MapPin className="h-6 w-6" />} />
                <StepTitle>Where are you based?</StepTitle>
                <StepBlurb>Clients love working with local talent.</StepBlurb>
                <input
                  autoFocus
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Addis Ababa"
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
                <StepTitle>Set your hourly rate</StepTitle>
                <StepBlurb>You can always change this later.</StepBlurb>
                <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-center">
                  <div className="grad-text text-5xl font-extrabold tracking-tight">
                    {formatEtb(rate)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">per hour</div>
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
            'Finish setup'
          ) : (
            <>
              Continue <ArrowRight className="h-4 w-4" />
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

function SkillsPicker({
  selected,
  onChange,
}: {
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  const [q, setQ] = useState('');
  const { data, isLoading } = useSkills(q);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < 15) next.add(id);
    onChange(next);
  };

  return (
    <>
      <StepIcon icon={<Wrench className="h-6 w-6" />} />
      <StepTitle>What are your skills?</StepTitle>
      <StepBlurb>Pick up to 15 that best describe your work.</StepBlurb>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search skills…"
        className="mt-6 h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {isLoading && (
          <div className="grid h-24 w-full place-items-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {data?.items.map((s: Skill) => {
          const active = selected.has(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className={cn(
                'rounded-full border px-3.5 py-2 text-xs font-semibold transition-all active:scale-95',
                active
                  ? 'grad-hero border-transparent text-white shadow-md shadow-primary/40'
                  : 'border-border bg-card text-muted-foreground',
              )}
            >
              {s.name}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        {selected.size}/15 selected
      </p>
    </>
  );
}
