'use client';

import { dt } from '@/i18n/auto';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Sparkles, ArrowRight, Loader2, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { useAIBrief } from '@/hooks/use-ai';
/**
 * AI Brief Generator — client describes what they want in a sentence,
 * we structure it into a complete job post (title, description, skills,
 * budget suggestion). Local generator today; swap for /v1/ai/brief later.
 */
export default function AIBriefPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [idea, setIdea] = useState('');
  const [result, setResult] = useState<{
    title: string;
    description: string;
    skills: string[];
    budgetMinEtb: number;
    budgetMaxEtb: number;
    source: 'ai' | 'fallback';
  } | null>(null);
  const ai = useAIBrief();

  const generate = async () => {
    if (idea.trim().length < 15) {
      toast.error(dt('Tell us a bit more first (15+ chars)'));
      return;
    }
    try {
      const r = await ai.mutateAsync({ idea });
      setResult(r);
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? 'Generation failed');
    }
  };

  const usePost = () => {
    if (!result) return;
    const p = new URLSearchParams();
    p.set('title', result.title);
    p.set('description', result.description);
    p.set('skills', result.skills.join(','));
    p.set('budgetMin', String(result.budgetMinEtb));
    p.set('budgetMax', String(result.budgetMaxEtb));
    router.push(`/jobs/new?${p.toString()}`);
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
          <h1 className="text-lg font-extrabold tracking-tight">{dt('AI Brief Generator')}</h1>
          <div className="text-[10px] text-muted-foreground">
            Describe what you need · Get a job post
          </div>
        </div>
      </header>

      <div className="mx-3 mt-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {dt('Describe your project')}
        </label>
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={5}
          placeholder={dt(
            'I need a mobile app for my restaurant with menu, ordering, and Telebirr payment…',
          )}
          className="mt-1.5 w-full resize-none rounded-2xl border border-border bg-card p-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
        />
        <Button
          variant="brand"
          size="lg"
          className="mt-3 w-full"
          onClick={generate}
          disabled={ai.isPending}
        >
          {ai.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Generate job brief
            </>
          )}
        </Button>
      </div>

      {result && (
        <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {dt('Generated brief')}
            </div>
            {result.source === 'ai' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                <Cpu className="h-2.5 w-2.5" /> AI
              </span>
            )}
          </div>
          <h2 className="mt-2 text-lg font-extrabold leading-snug">{result.title}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {result.description}
          </p>
          <div className="mt-3">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">
              {dt('Suggested skills')}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {result.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">
              {dt('Suggested budget')}
            </div>
            <div className="mt-1 text-sm font-extrabold text-primary">
              {result.budgetMinEtb.toLocaleString()} – {result.budgetMaxEtb.toLocaleString()} ETB
            </div>
          </div>
          <Button variant="brand" size="lg" className="mt-4 w-full" onClick={usePost}>
            Post this job <ArrowRight className="h-4 w-4" />
          </Button>
        </section>
      )}
    </div>
  );
}
