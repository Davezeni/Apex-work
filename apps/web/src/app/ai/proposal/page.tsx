'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Sparkles, Copy, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';

/**
 * AI Proposal Writer. Backend LLM integration is stubbed for now — we
 * generate a well-structured proposal template locally so the UX is real
 * and testable. When the /v1/ai/proposal endpoint ships, swap the local
 * generator for a fetch call.
 */
export default function AIProposalPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [jobDesc, setJobDesc] = useState('');
  const [name, setName] = useState('');
  const [skills, setSkills] = useState('');
  const [tone, setTone] = useState<'friendly' | 'professional' | 'confident'>('friendly');
  const [output, setOutput] = useState('');
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (jobDesc.trim().length < 30) {
      toast.error('Paste the job description first (30+ chars)');
      return;
    }
    setGenerating(true);
    setOutput('');
    // Simulate stream so the UX feels alive.
    const template = buildProposal({ jobDesc, name: name || 'there', skills, tone });
    for (let i = 0; i < template.length; i += 8) {
      await new Promise((r) => setTimeout(r, 12));
      setOutput(template.slice(0, i + 8));
    }
    setGenerating(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      toast.success('Proposal copied');
    } catch { toast.error('Copy failed'); }
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} aria-label={t('common.back')} className="grid h-9 w-9 place-items-center rounded-full active:scale-90">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">AI Proposal Writer</h1>
          <div className="text-[10px] text-muted-foreground">Land more jobs · Draft in 5 seconds</div>
        </div>
      </header>

      <div className="mx-3 mt-4 space-y-3">
        <Field label="Job description (paste)">
          <textarea
            value={jobDesc}
            onChange={(e) => setJobDesc(e.target.value)}
            rows={6}
            maxLength={4000}
            placeholder="Paste the job post here…"
            className="w-full resize-none rounded-xl border border-border bg-card p-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Your name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kaleb" className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20" />
          </Field>
          <Field label="Key skills">
            <input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, Next.js" className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20" />
          </Field>
        </div>
        <Field label="Tone">
          <div className="flex gap-2">
            {(['friendly', 'professional', 'confident'] as const).map((t2) => (
              <button
                key={t2}
                onClick={() => setTone(t2)}
                className={`flex-1 rounded-xl border-2 px-3 py-2 text-xs font-semibold capitalize ${
                  tone === t2 ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card'
                }`}
              >
                {t2}
              </button>
            ))}
          </div>
        </Field>

        <Button variant="brand" size="lg" className="w-full" onClick={generate} disabled={generating}>
          {generating ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Generate proposal</>
          )}
        </Button>
      </div>

      {output && (
        <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your proposal</div>
            <div className="flex gap-1">
              <button onClick={generate} disabled={generating} aria-label="Regenerate" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground active:bg-muted">
                <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={copy} aria-label="Copy" className="grid h-8 w-8 place-items-center rounded-lg text-primary active:bg-primary/10">
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
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function buildProposal({
  jobDesc, name, skills, tone,
}: { jobDesc: string; name: string; skills: string; tone: 'friendly' | 'professional' | 'confident' }) {
  const opener = tone === 'friendly'
    ? `Hi ${name === 'there' ? 'there' : name}! 👋 Excited to help with this — here's how I'd approach it.`
    : tone === 'professional'
      ? `Hello, thank you for the detailed brief. Below is my proposed approach and timeline.`
      : `Hey ${name}, I've delivered exactly this kind of project multiple times — here's my plan.`;

  const focus = jobDesc
    .split(/[.\n]/)
    .filter((s) => s.trim().length > 15)
    .slice(0, 3)
    .map((s, i) => `  ${i + 1}. ${s.trim().replace(/^[-•]/, '').trim()}`)
    .join('\n');

  const skillLine = skills.trim()
    ? `I'll rely on my strengths in ${skills.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4).join(', ')}.`
    : `I'll bring the right tools and experience to nail this project.`;

  return `${opener}

Understanding of your needs:
${focus || '  1. Deliver high-quality work within your budget and timeline.'}

My approach:
  • Discovery — 30-min call to lock scope and success criteria
  • Milestone 1 — first deliverable within 3 days for early feedback
  • Milestone 2 — refinements + final polish
  • Handover — everything documented, no loose ends

${skillLine}

I'd love a quick chat to align on details. If you want to start today, I can begin within 2 hours.

Best,
${name === 'there' ? '—' : name}`;
}
