'use client';

import { dt } from '@/i18n/auto';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Sparkles, Copy, RefreshCw, Loader2, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { useAIProposal } from '@/hooks/use-ai';
import { useJob } from '@/hooks/use-jobs';
import { useMe } from '@/hooks/use-me';
/**
 * AI Proposal Writer. The API uses the configured LLM when available and
 * returns a deterministic local template when the free-tier key is absent,
 * so the tool remains usable in every environment.
 *
 * Accepts ?job=<id> to auto-fill the description, skills, budget, and the
 * user's own name straight from a posted job (one tap from the job page).
 */
export default function AIProposalPage() {
  return (
    <Suspense fallback={null}>
      <ProposalInner />
    </Suspense>
  );
}

function ProposalInner() {
  const router = useRouter();
  const { t } = useI18n();
  const params = useSearchParams();
  const jobId = params.get('job') ?? undefined;
  const { data: job } = useJob(jobId);
  const { data: me } = useMe();
  const [jobDesc, setJobDesc] = useState('');
  const [name, setName] = useState('');
  const [skills, setSkills] = useState('');
  const [tone, setTone] = useState<'friendly' | 'professional' | 'confident'>('friendly');
  const [output, setOutput] = useState('');
  const [source, setSource] = useState<'ai' | 'fallback' | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const ai = useAIProposal();

  // One-tap prefill from the job page (?job=<id>).
  useEffect(() => {
    if (!job || prefilled) return;
    const budget =
      job.budgetMinEtb != null || job.budgetMaxEtb != null
        ? `\nBudget: ${job.budgetMinEtb ?? '?'}–${job.budgetMaxEtb ?? '?'} ETB`
        : '';
    const reqSkills = job.requiredSkills?.length
      ? `\nRequired skills: ${job.requiredSkills.join(', ')}`
      : '';
    setJobDesc((v) => v || `${job.title}${budget}${reqSkills}\n\n${job.description}`);
    if (job.requiredSkills?.length) setSkills((v) => v || job.requiredSkills.join(', '));
    setPrefilled(true);
  }, [job, prefilled]);

  // Prefill the user's own name once we know who they are.
  useEffect(() => {
    if (me?.fullName) setName((v) => v || me.fullName);
  }, [me?.fullName]);

  const generate = async () => {
    if (jobDesc.trim().length < 30) {
      toast.error(dt('Paste the job description first (30+ chars)'));
      return;
    }
    setOutput('');
    setSource(null);
    try {
      const r = await ai.mutateAsync({ jobDescription: jobDesc, name, skills, tone });
      setSource(r.source);
      // Progressive reveal so the UI feels alive without a real stream.
      for (let i = 0; i < r.text.length; i += 8) {
        await new Promise((res) => setTimeout(res, 8));
        setOutput(r.text.slice(0, i + 8));
      }
      setOutput(r.text);
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? 'Generation failed');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      toast.success(dt('Proposal copied'));
    } catch {
      toast.error(dt('Copy failed'));
    }
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">{dt('AI Proposal Writer')}</h1>
          <div className="text-[10px] text-muted-foreground">
            Land more jobs · Draft in 5 seconds
          </div>
        </div>
      </header>

      <div className="mx-3 mt-4 space-y-3">
        {job && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              {dt('Loaded from job')}: {job.title}
            </span>
          </div>
        )}
        <Field label={dt('Job description (paste)')}>
          <textarea
            value={jobDesc}
            onChange={(e) => setJobDesc(e.target.value)}
            rows={6}
            maxLength={4000}
            placeholder={dt('Paste the job post here…')}
            className="w-full resize-none rounded-xl border border-border bg-card p-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={dt('Your name')}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={dt('Kaleb')}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
            />
          </Field>
          <Field label={dt('Key skills')}>
            <input
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder={dt('React, Next.js')}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
            />
          </Field>
        </div>
        <Field label={dt('Tone')}>
          <div className="flex gap-2">
            {(['friendly', 'professional', 'confident'] as const).map((t2) => (
              <button
                key={t2}
                onClick={() => setTone(t2)}
                className={`flex-1 rounded-xl border-2 px-3 py-2 text-xs font-semibold capitalize ${
                  tone === t2
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card'
                }`}
              >
                {t2}
              </button>
            ))}
          </div>
        </Field>

        <Button
          variant="brand"
          size="lg"
          className="w-full"
          onClick={generate}
          disabled={ai.isPending}
        >
          {ai.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Generating…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Generate proposal
            </>
          )}
        </Button>
      </div>

      {output && (
        <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {dt('Your proposal')}
              </div>
              {source === 'ai' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  <Cpu className="h-2.5 w-2.5" /> AI
                </span>
              )}
              {source === 'fallback' && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {dt('TEMPLATE')}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              <button
                onClick={generate}
                disabled={ai.isPending}
                aria-label={dt('Regenerate')}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground active:bg-muted"
              >
                <RefreshCw className={`h-4 w-4 ${ai.isPending ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={copy}
                aria-label={dt('Copy')}
                className="grid h-8 w-8 place-items-center rounded-lg text-primary active:bg-primary/10"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed">{output}</pre>
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
