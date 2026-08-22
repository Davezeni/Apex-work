'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, X, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import { useCreateJob } from '@/hooks/use-jobs';
import { useI18n } from '@/i18n';
import { CATEGORIES, MIN_GIG_PRICE_ETB } from '@apex-work/shared';
import { cn } from '@/lib/utils';

const STEPS = ['step1', 'step2', 'step3'] as const;
type Step = (typeof STEPS)[number];

export default function NewJobPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: me, isLoading, isAuthed } = useMe();
  const create = useCreateJob();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>('step1');
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string>('development');
  const [description, setDescription] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [isRemote, setIsRemote] = useState(true);
  const [attachments, setAttachments] = useState<{ url: string; name: string; contentType: string; sizeBytes: number }[]>([]);

  useEffect(() => {
    if (!isLoading && !isAuthed) router.replace('/login?next=/jobs/new');
  }, [isLoading, isAuthed, router]);

  // Prefill from AI Brief Generator (?title=…&description=…&skills=…&budgetMin=…&budgetMax=…)
  useEffect(() => {
    const t2 = searchParams.get('title');
    const d = searchParams.get('description');
    const s = searchParams.get('skills');
    const bmin = searchParams.get('budgetMin');
    const bmax = searchParams.get('budgetMax');
    if (t2) setTitle(t2);
    if (d) setDescription(d);
    if (s) setSkills(s.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 15));
    if (bmin) setBudgetMin(bmin);
    if (bmax) setBudgetMax(bmax);
    if (t2 || d) toast.success('Filled from your AI brief ✨');
  }, [searchParams]);

  const stepIdx = STEPS.indexOf(step);

  const canNext =
    (step === 'step1' && title.trim().length >= 10 && !!categoryId) ||
    (step === 'step2' && description.trim().length >= 30) ||
    step === 'step3';

  const submit = async () => {
    const min = budgetMin.trim() ? Number(budgetMin) : undefined;
    const max = budgetMax.trim() ? Number(budgetMax) : undefined;
    if (min != null && min < MIN_GIG_PRICE_ETB)
      return toast.error(`Min budget ≥ ${MIN_GIG_PRICE_ETB} ETB`);
    if (min != null && max != null && min > max)
      return toast.error('Max budget must be ≥ min');
    try {
      const job = await create.mutateAsync({
        title: title.trim(),
        categoryId,
        description: description.trim(),
        requiredSkills: skills,
        budgetMinEtb: min,
        budgetMaxEtb: max,
        isRemote,
        attachments,
      });
      toast.success(t('jobs.published'));
      router.replace(`/jobs/${job.id}`);
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? t('jobs.publishFailed'));
    }
  };

  const addSkill = () => {
    const s = skillInput.trim().slice(0, 40);
    if (!s) return;
    if (skills.includes(s)) return;
    if (skills.length >= 15) return;
    setSkills([...skills, s]);
    setSkillInput('');
  };

  if (isLoading || !me) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-32">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => (stepIdx > 0 ? setStep(STEPS[stepIdx - 1]!) : router.back())}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-1 gap-1">
          {STEPS.map((s, i) => (
            <div
              key={s}
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

      <main className="mx-auto w-full max-w-md px-5 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight">{t(`jobs.${step}`)}</h1>
          {step === 'step1' && (
            <Link href="/ai/brief" className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary active:scale-95">
              <Sparkles className="h-3 w-3" /> AI Brief
            </Link>
          )}
        </div>

        {step === 'step1' && (
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('jobs.jobTitle')}
              </label>
              <textarea
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                rows={2}
                maxLength={140}
                placeholder={t('jobs.jobTitleHint')}
                className="w-full resize-none rounded-2xl border border-border bg-card p-3 text-base font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
              />
              <p className="mt-1 text-right text-[11px] text-muted-foreground">
                {title.length}/140
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('jobs.category')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategoryId(c.id)}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-all active:scale-95',
                      categoryId === c.id
                        ? 'border-primary bg-primary/10 shadow-md shadow-primary/20'
                        : 'border-border bg-card',
                    )}
                  >
                    <div className="text-xl">{c.icon}</div>
                    <div className="mt-1 text-xs font-semibold">{c.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'step2' && (
          <div className="mt-6">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('jobs.description')}
            </label>
            <textarea
              autoFocus
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={12}
              maxLength={6000}
              placeholder={t('jobs.descPlaceholder')}
              className="w-full resize-none rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
            />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">
              {description.length}/6000
            </p>
          </div>
        )}

        {step === 'step3' && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('jobs.budgetMin')}
                </label>
                <input
                  inputMode="numeric"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="1,000"
                  className="w-full rounded-xl border border-border bg-card px-3 py-3 text-sm font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('jobs.budgetMax')}
                </label>
                <input
                  inputMode="numeric"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="5,000"
                  className="w-full rounded-xl border border-border bg-card px-3 py-3 text-sm font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('jobs.skills')}
              </label>
              <div className="flex gap-2">
                <input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder={t('jobs.skillsPlaceholder')}
                  className="flex-1 rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
                />
                <Button variant="outline" onClick={addSkill}>
                  <Plus className="h-4 w-4" /> {t('jobs.addSkill')}
                </Button>
              </div>
              {skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs"
                    >
                      {s}
                      <button
                        onClick={() => setSkills(skills.filter((x) => x !== s))}
                        aria-label={t('common.delete')}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm">
              <input
                type="checkbox"
                checked={isRemote}
                onChange={(e) => setIsRemote(e.target.checked)}
                className="h-4 w-4"
              />
              {t('jobs.remote')}
            </label>

            <JobAttachmentsField
              items={attachments}
              onChange={setAttachments}
            />
          </div>
        )}
      </main>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pb-4 pt-3 backdrop-blur-xl">
        <Button
          variant="brand"
          size="lg"
          className="w-full"
          disabled={!canNext || create.isPending}
          onClick={() => {
            if (step === 'step3') void submit();
            else setStep(STEPS[stepIdx + 1]!);
          }}
        >
          {create.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : step === 'step3' ? (
            t('jobs.publish')
          ) : (
            t('common.next')
          )}
        </Button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// JOB ATTACHMENTS FIELD
// -----------------------------------------------------------------------------
import { useUpload } from '@/hooks/use-upload';
import { Paperclip, X as XClose } from 'lucide-react';

function JobAttachmentsField({
  items, onChange,
}: {
  items: { url: string; name: string; contentType: string; sizeBytes: number }[];
  onChange: (next: { url: string; name: string; contentType: string; sizeBytes: number }[]) => void;
}) {
  const upload = useUpload();
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (items.length >= 5) return toast.error('Max 5 attachments');
    if (file.size > 25 * 1024 * 1024) return toast.error('Max 25 MB per file');
    try {
      const uploaded = await upload.mutateAsync({ file, bucket: 'chat-attachments' });
      onChange([...items, {
        url: uploaded.publicUrl,
        name: file.name.slice(0, 200),
        contentType: uploaded.contentType,
        sizeBytes: uploaded.sizeBytes,
      }]);
    } catch (err) {
      toast.error((err as { message?: string }).message ?? 'Upload failed');
    }
  };
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Reference files (optional)
      </label>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card px-3 py-4 text-sm text-muted-foreground hover:border-primary/40">
        {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        <span>{upload.isPending ? 'Uploading…' : 'Attach brief / mockups / spec (≤ 25MB × 5)'}</span>
        <input type="file" className="hidden" onChange={onFile} disabled={upload.isPending || items.length >= 5} />
      </label>
      {items.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {items.map((a, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-xs">
              <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{a.name}</span>
              <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                {(a.sizeBytes / 1024).toFixed(0)} KB
              </span>
              <button
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                aria-label="Remove"
                className="grid h-6 w-6 place-items-center rounded-full text-red-500 active:bg-red-500/10"
              >
                <XClose className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
