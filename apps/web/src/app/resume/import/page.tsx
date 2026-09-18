'use client';

import { dt } from '@/i18n/auto';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
  FileInput,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import { useMyResume, useUpdateResume } from '@/hooks/use-resume';
import type { ResumeContent } from '@apex-work/shared';
import { API_BASE } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { safeBack } from '@/lib/safe-back';
type Parsed = {
  headline: string;
  summary: string;
  skills: string[];
  projects: { title: string; description: string }[];
};

function parseResumeText(raw: string): Parsed {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const section = (names: string[]) => {
    const index = lines.findIndex((line) => names.some((name) => line.toLowerCase() === name));
    if (index < 0) return [];
    const end = lines.findIndex(
      (line, lineIndex) =>
        lineIndex > index &&
        /^(summary|profile|about|skills?|experience|employment|education|projects?|portfolio|certifications?|achievements?)$/i.test(
          line,
        ),
    );
    return lines.slice(index + 1, end < 0 ? lines.length : end);
  };
  const summaryLines = section(['summary', 'profile', 'about']);
  const skillLines = section(['skills', 'technical skills', 'core skills']);
  const projectLines = section(['projects', 'portfolio']);
  const skills = skillLines
    .join(',')
    .split(/[,|•·]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .slice(0, 40);
  const projects = projectLines
    .filter((line) => line.length >= 2)
    .slice(0, 20)
    .map((line) => ({ title: line.replace(/^[-•*]\s*/, '').slice(0, 120), description: '' }));
  return {
    headline: lines[0]?.slice(0, 120) ?? '',
    summary: summaryLines.join(' ').slice(0, 2000),
    skills,
    projects,
  };
}

export default function ResumeImportPage() {
  const router = useRouter();
  const { data: me, isLoading: meLoading, isAuthed } = useMe();
  const { data: resume, isLoading: resumeLoading } = useMyResume();
  const update = useUpdateResume();
  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const token = useAuthStore((s) => s.accessToken);
  const fileBusy = useRef(false);
  const [busy, setBusy] = useState<'file' | 'ocr' | null>(null);

  const applyText = (text: string, source: string) => {
    setRaw(text);
    setParsed(parseResumeText(text));
    toast.success(source);
  };

  // Upload a real CV (PDF / DOCX / TXT — a LinkedIn "Export as PDF" works too)
  // and let the API extract the text.
  const importFile = async (file: File) => {
    if (fileBusy.current) return;
    if (file.size > 15 * 1024 * 1024) return toast.error(dt('Max 15 MB per CV'));
    fileBusy.current = true;
    setBusy('file');
    try {
      const res = await fetch(
        `${API_BASE}/v1/me/resume/parse-file?filename=${encodeURIComponent(file.name)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        },
      );
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { text?: string };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok || !json.data?.text) {
        throw new Error(json.error?.message || dt('Could not read that file'));
      }
      applyText(json.data.text, dt('CV text extracted — review it below'));
    } catch (err) {
      toast.error((err as Error).message || dt('Could not read that file'));
    } finally {
      fileBusy.current = false;
      setBusy(null);
    }
  };

  // Snap a paper CV and read it right in the browser (free OCR, no server).
  const scanPhoto = async (file: File) => {
    if (fileBusy.current) return;
    fileBusy.current = true;
    setBusy('ocr');
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng+amh');
      const { data } = await worker.recognize(file);
      await worker.terminate();
      const text = (data?.text ?? '').replace(/[ \t]+/g, ' ').trim();
      if (text.replace(/\s+/g, '').length < 40) {
        throw new Error(dt('Could not read enough text — try a sharper, well-lit photo'));
      }
      applyText(text, dt('Photo scanned — review it below'));
    } catch (err) {
      toast.error((err as Error).message || dt('Could not read that photo'));
    } finally {
      fileBusy.current = false;
      setBusy(null);
    }
  };

  // Prefill from the Apex profile the user already filled in.
  const fillFromProfile = () => {
    const headline = me?.title ?? '';
    const summary = me?.bio ?? '';
    if (!headline && !summary) {
      return toast.error(dt('Your profile has no title or bio yet — add them first'));
    }
    setRaw([headline, summary].filter(Boolean).join('\n\n'));
    setParsed({ headline, summary, skills: [], projects: [] });
    toast.success(dt('Prefilled from your profile — review it below'));
  };

  const ready = useMemo(
    () =>
      !!parsed &&
      (parsed.headline || parsed.summary || parsed.skills.length > 0 || parsed.projects.length > 0),
    [parsed],
  );
  if (meLoading || resumeLoading || !me)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (!isAuthed) return null;

  const parse = () => {
    if (raw.trim().length < 20)
      return toast.error(dt('Paste at least a few lines from your CV or LinkedIn profile'));
    setParsed(parseResumeText(raw));
  };
  const importData = async () => {
    if (!parsed || !resume) return;
    const current = resume.content;
    const existingSkills = new Set(current.skills.map((skill) => skill.name.toLowerCase()));
    const content: ResumeContent = {
      ...current,
      skills: [
        ...current.skills,
        ...parsed.skills
          .filter((skill) => !existingSkills.has(skill.toLowerCase()))
          .map((name) => ({ name, level: 3 })),
      ].slice(0, 40),
      projects: [
        ...current.projects,
        ...parsed.projects.map((project) => ({
          ...project,
          role: null,
          url: null,
          technologies: [],
          highlights: [],
          startYear: null,
          endYear: null,
        })),
      ].slice(0, 20),
    };
    try {
      await update.mutateAsync({
        headline: parsed.headline || resume.headline,
        summary: parsed.summary || resume.summary,
        content,
        languages: resume.languages,
        theme: resume.theme,
      });
      toast.success(dt('Imported into Resume Studio'));
      router.push('/resume');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed');
    }
  };

  return (
    <div className="min-h-dvh bg-background pb-12">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => safeBack(router)}
          aria-label={dt('Back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-extrabold">{dt('Import your career data')}</h1>
          <p className="text-[10px] text-muted-foreground">
            Bring in a CV, LinkedIn About section or plain text. Review before saving.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/resume">
            <FileText className="h-4 w-4" /> Studio
          </Link>
        </Button>
      </header>
      <main className="mx-auto max-w-4xl px-3 py-6 sm:px-6">
        <section className="rounded-3xl border border-primary/20 bg-primary/5 p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <FileInput className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-black">{dt('Import, then polish.')}</h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {/* Fast paths: file, profile, photo. All feed the same review step. */}
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-3 py-4 text-center transition-colors hover:bg-primary/10">
                    {busy === 'file' ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <Upload className="h-5 w-5 text-primary" />
                    )}
                    <span className="text-xs font-bold">
                      {busy === 'file' ? dt('Extracting…') : dt('Upload CV')}
                    </span>
                    <span className="text-[10px] text-muted-foreground">PDF · DOCX · TXT</span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.md,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) void importFile(f);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={fillFromProfile}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card px-3 py-4 text-center transition-colors hover:bg-muted"
                  >
                    <UserCheck className="h-5 w-5 text-primary" />
                    <span className="text-xs font-bold">{dt('From my profile')}</span>
                    <span className="text-[10px] text-muted-foreground">{dt('One tap')}</span>
                  </button>
                  <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border border-border bg-card px-3 py-4 text-center transition-colors hover:bg-muted">
                    {busy === 'ocr' ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <Camera className="h-5 w-5 text-primary" />
                    )}
                    <span className="text-xs font-bold">
                      {busy === 'ocr' ? dt('Scanning…') : dt('Scan a photo')}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{dt('Paper CV')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) void scanPhoto(f);
                      }}
                    />
                  </label>
                </div>
                <div className="mt-3" />
                Paste text exported from LinkedIn or an old CV. We only parse obvious headings and
                skills locally in your browser; nothing is saved until you approve it.
              </p>
            </div>
          </div>
          <textarea
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            rows={12}
            placeholder={
              'Paste your text here…\n\nJohn Doe\nFrontend Developer\n\nSummary\nI build…\n\nSkills\nReact, TypeScript, Figma'
            }
            className="mt-5 min-h-[240px] w-full rounded-2xl border border-border bg-background p-4 text-sm leading-relaxed outline-none focus:border-primary"
          />
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="outline" onClick={parse}>
              <Sparkles className="h-4 w-4" /> Preview import
            </Button>
            <Button
              type="button"
              variant="brand"
              onClick={importData}
              disabled={!ready || update.isPending}
            >
              {update.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}{' '}
              Import to my CV
            </Button>
          </div>
        </section>
        {parsed && (
          <section className="mt-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-extrabold">{dt('Review detected content')}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-background p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Headline
                </div>
                <p className="mt-1 text-sm font-semibold">{parsed.headline || 'Not detected'}</p>
              </div>
              <div className="rounded-xl bg-background p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Summary
                </div>
                <p className="mt-1 line-clamp-5 text-xs text-muted-foreground">
                  {parsed.summary || 'Not detected'}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Skills · {parsed.skills.length}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {parsed.skills.length ? (
                  parsed.skills.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"
                    >
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">{dt('No skills detected')}</span>
                )}
              </div>
            </div>
            <div className="mt-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Projects · {parsed.projects.length}
              </div>
              <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                {parsed.projects.length ? (
                  parsed.projects.map((item) => <li key={item.title}>{item.title}</li>)
                ) : (
                  <li>{dt('No project heading detected')}</li>
                )}
              </ul>
            </div>
            <p className="mt-4 text-[11px] text-muted-foreground">
              Import is additive: existing resume content remains, and duplicate skills are skipped.
              Use Resume Studio to verify experience and dates manually.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
