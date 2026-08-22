'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';

/**
 * AI Brief Generator — client describes what they want in a sentence,
 * we structure it into a complete job post (title, description, skills,
 * budget suggestion). Local generator today; swap for /v1/ai/brief later.
 */
export default function AIBriefPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [idea, setIdea] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ title: string; description: string; skills: string[]; budgetMin: number; budgetMax: number } | null>(null);

  const generate = async () => {
    if (idea.trim().length < 15) {
      toast.error('Tell us a bit more first (15+ chars)');
      return;
    }
    setBusy(true);
    await new Promise((r) => setTimeout(r, 800));
    setResult(buildBrief(idea));
    setBusy(false);
  };

  const usePost = () => {
    if (!result) return;
    const p = new URLSearchParams();
    p.set('title', result.title);
    p.set('description', result.description);
    p.set('skills', result.skills.join(','));
    p.set('budgetMin', String(result.budgetMin));
    p.set('budgetMax', String(result.budgetMax));
    router.push(`/jobs/new?${p.toString()}`);
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} aria-label={t('common.back')} className="grid h-9 w-9 place-items-center rounded-full active:scale-90">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">AI Brief Generator</h1>
          <div className="text-[10px] text-muted-foreground">Describe what you need · Get a job post</div>
        </div>
      </header>

      <div className="mx-3 mt-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Describe your project</label>
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={5}
          placeholder="I need a mobile app for my restaurant with menu, ordering, and Telebirr payment…"
          className="mt-1.5 w-full resize-none rounded-2xl border border-border bg-card p-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
        />
        <Button variant="brand" size="lg" className="mt-3 w-full" onClick={generate} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4" /> Generate job brief</>}
        </Button>
      </div>

      {result && (
        <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Generated brief</div>
          <h2 className="mt-2 text-lg font-extrabold leading-snug">{result.title}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{result.description}</p>
          <div className="mt-3">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Suggested skills</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {result.skills.map((s) => (
                <span key={s} className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs">{s}</span>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Suggested budget</div>
            <div className="mt-1 text-sm font-extrabold text-primary">
              {result.budgetMin.toLocaleString()} – {result.budgetMax.toLocaleString()} ETB
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

function buildBrief(idea: string): { title: string; description: string; skills: string[]; budgetMin: number; budgetMax: number } {
  const lower = idea.toLowerCase();
  const category =
    /app|mobile|ios|android|flutter|react.native/.test(lower) ? 'mobile'
      : /website|landing|next|react|web|wordpress/.test(lower) ? 'web'
      : /logo|brand|design|figma/.test(lower) ? 'design'
      : /video|reels|tiktok/.test(lower) ? 'video'
      : /translate|blog|write|content|seo/.test(lower) ? 'writing'
      : 'general';

  const skillPool: Record<string, string[]> = {
    mobile: ['react-native', 'flutter', 'firebase', 'ios', 'android'],
    web: ['nextjs', 'react', 'tailwind', 'typescript', 'chapa'],
    design: ['figma', 'ui-design', 'branding', 'prototyping'],
    video: ['video-editing', 'premiere', 'after-effects', 'motion-graphics'],
    writing: ['copywriting', 'seo', 'amharic', 'blog'],
    general: ['communication', 'time-management', 'freelance'],
  };

  const budgetTiers: Record<string, [number, number]> = {
    mobile: [15000, 60000],
    web: [8000, 30000],
    design: [3000, 12000],
    video: [3000, 10000],
    writing: [2000, 8000],
    general: [3000, 12000],
  };

  const [min, max] = budgetTiers[category] ?? [3000, 12000];
  const skills = skillPool[category] ?? ['freelance'];

  const rawTitle = idea.length > 100 ? idea.slice(0, 97) + '…' : idea.replace(/^i (need|want)/i, 'Looking for someone to').replace(/^need /i, 'Need ');
  const title = (rawTitle[0]?.toUpperCase() ?? '') + rawTitle.slice(1);

  const description = `${idea}

Ideal freelancer:
  • Has shipped similar projects before
  • Communicates clearly in English or Amharic
  • Available for a quick kickoff call this week

Deliverables:
  • Regular progress updates
  • Source files / access on completion
  • Post-delivery support for 7 days

Please share 2-3 relevant examples of your past work when you apply.`;

  return {
    title,
    description,
    skills,
    budgetMin: min,
    budgetMax: max,
  };
}
