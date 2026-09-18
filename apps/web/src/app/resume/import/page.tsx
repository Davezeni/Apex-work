'use client';

import { dt } from '@/i18n/auto';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Briefcase,
  Camera,
  FileInput,
  FileText,
  GraduationCap,
  Loader2,
  Mail,
  Plus,
  Sparkles,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import {
  useAddCertification,
  useAddEducation,
  useAddExperience,
  useMyResume,
  useUpdateResume,
} from '@/hooks/use-resume';
import type { ResumeContent } from '@apex-work/shared';
import { API_BASE } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { safeBack } from '@/lib/safe-back';

// ---------------- types (mirror the API extraction 1:1) ----------------
type ExpDraft = {
  company: string;
  role: string;
  location: string;
  startYear: string;
  startMonth: string;
  endYear: string;
  endMonth: string;
  current: boolean;
  description: string;
};
type EduDraft = {
  school: string;
  degree: string;
  fieldOfStudy: string;
  startYear: string;
  endYear: string;
  description: string;
};
type CertDraft = { name: string; issuer: string; issueYear: string };
type ProjDraft = { title: string; description: string };

interface Extracted {
  name: string | null;
  headline: string;
  targetRole: string;
  summary: string;
  email: string;
  phone: string;
  city: string;
  website: string;
  linkedin: string;
  github: string;
  skills: string[];
  languages: string[];
  achievements: string;
  interests: string[];
  experiences: ExpDraft[];
  education: EduDraft[];
  certifications: CertDraft[];
  projects: ProjDraft[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Heuristic fallback when the AI extractor is unavailable. */
function parseResumeText(raw: string): Extracted {
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
  const seen = new Set<string>();
  const skills = skillLines
    .join(',')
    .split(/[,|•·]/)
    .map((item) => item.trim().slice(0, 60))
    .filter((item) => {
      if (item.length < 2) return false;
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 40);
  const projects = projectLines
    .filter((line) => line.length >= 2)
    .slice(0, 10)
    .map((line) => ({
      title: line.replace(/^[-•*]\s*/, '').slice(0, 120),
      description: '',
    }));
  const emailMatch = raw.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  const phoneMatch =
    raw.match(/(?:\+?251|0)[\s-]?9\d(?:[\s-]?\d{3})[\s-]?\d{3,4}/) ||
    raw.match(/\+?\d[\d\s().-]{7,}\d/);
  return {
    name: null,
    headline: lines[0]?.slice(0, 120) ?? '',
    targetRole: '',
    summary: summaryLines.join(' ').slice(0, 2000),
    email: emailMatch ? emailMatch[0].slice(0, 200) : '',
    phone: phoneMatch ? phoneMatch[0].slice(0, 40) : '',
    city: '',
    website: '',
    linkedin: '',
    github: '',
    skills,
    languages: [],
    achievements: '',
    interests: [],
    experiences: [],
    education: [],
    certifications: [],
    projects,
  };
}

const MONTH_RE = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
function monthFrom(v: string): string {
  const n = Number(v.replace(/[^0-9]/g, ''));
  if (n >= 1 && n <= 12) return String(n);
  const idx = MONTHS.findIndex((m) => v.trim().toLowerCase().startsWith(m.toLowerCase()));
  return idx >= 0 ? String(idx + 1) : '1';
}

/** Map the API's AI extraction onto the editable draft state. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromApiExtraction(x: any): Extracted {
  const s = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
  return {
    name: s(x.name) || null,
    headline: s(x.headline).slice(0, 120),
    targetRole: s(x.targetRole).slice(0, 120),
    summary: s(x.summary).slice(0, 2000),
    email: s(x.email).slice(0, 200),
    phone: s(x.phone).slice(0, 40),
    city: s(x.city).slice(0, 80),
    website: s(x.website).slice(0, 300),
    linkedin: s(x.linkedin).slice(0, 300),
    github: s(x.github).slice(0, 300),
    skills: Array.isArray(x.skills)
      ? x.skills
          .map((k: unknown) => s(k).slice(0, 60))
          .filter(Boolean)
          .slice(0, 40)
      : [],
    languages: Array.isArray(x.languages)
      ? x.languages
          .map((k: unknown) => s(k).slice(0, 60))
          .filter(Boolean)
          .slice(0, 15)
      : [],
    achievements: Array.isArray(x.achievements)
      ? x.achievements
          .map((k: unknown) => s(k).slice(0, 240))
          .filter(Boolean)
          .slice(0, 20)
          .join('\n')
      : '',
    interests: Array.isArray(x.interests)
      ? x.interests
          .map((k: unknown) => s(k).slice(0, 60))
          .filter(Boolean)
          .slice(0, 10)
      : [],
    experiences: Array.isArray(x.experiences)
      ? x.experiences.slice(0, 15).map((e: Record<string, unknown>) => ({
          company: s(e.company).slice(0, 120),
          role: s(e.role).slice(0, 120),
          location: s(e.location).slice(0, 120),
          startYear: s(e.startYear)
            .replace(/[^0-9]/g, '')
            .slice(0, 4),
          startMonth: monthFrom(s(e.startMonth) || '1'),
          endYear: s(e.endYear)
            .replace(/[^0-9]/g, '')
            .slice(0, 4),
          endMonth: s(e.endMonth) ? monthFrom(s(e.endMonth)) : '',
          current: !s(e.endYear),
          description: s(e.description).slice(0, 2000),
        }))
      : [],
    education: Array.isArray(x.education)
      ? x.education.slice(0, 10).map((e: Record<string, unknown>) => ({
          school: s(e.school).slice(0, 120),
          degree: s(e.degree).slice(0, 120),
          fieldOfStudy: s(e.fieldOfStudy).slice(0, 120),
          startYear: s(e.startYear)
            .replace(/[^0-9]/g, '')
            .slice(0, 4),
          endYear: s(e.endYear)
            .replace(/[^0-9]/g, '')
            .slice(0, 4),
          description: s(e.description).slice(0, 1000),
        }))
      : [],
    certifications: Array.isArray(x.certifications)
      ? x.certifications.slice(0, 10).map((c: Record<string, unknown>) => ({
          name: s(c.name).slice(0, 160),
          issuer: s(c.issuer).slice(0, 160),
          issueYear: s(c.issueYear)
            .replace(/[^0-9]/g, '')
            .slice(0, 4),
        }))
      : [],
    projects: Array.isArray(x.projects)
      ? x.projects.slice(0, 10).map((p: Record<string, unknown>) => ({
          title: s(p.title).slice(0, 120),
          description: s(p.description).slice(0, 1600),
        }))
      : [],
  };
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function Chips({ items, onRemove }: { items: string[]; onRemove: (item: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"
        >
          {item}
          <button type="button" onClick={() => onRemove(item)} aria-label="Remove">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {items.length === 0 && (
        <span className="text-xs text-muted-foreground">{dt('None detected')}</span>
      )}
    </div>
  );
}

const emptyYear = String(new Date().getFullYear());

export default function ResumeImportPage() {
  const router = useRouter();
  const { data: me, isLoading: meLoading, isAuthed } = useMe();
  const { data: resume, isLoading: resumeLoading } = useMyResume();
  const update = useUpdateResume();
  const addExperience = useAddExperience();
  const addEducation = useAddEducation();
  const addCertification = useAddCertification();
  const token = useAuthStore((s) => s.accessToken);

  const fileBusy = useRef(false);
  const [busy, setBusy] = useState<'file' | 'ocr' | 'ai' | null>(null);
  const [raw, setRaw] = useState('');
  const [ex, setEx] = useState<Extracted | null>(null);
  const [engine, setEngine] = useState<'ai' | 'basic' | null>(null);
  const [alsoProfile, setAlsoProfile] = useState(true);
  const [importing, setImporting] = useState(false);

  const ready = !!ex;

  const patch = (p: Partial<Extracted>) => setEx((prev) => (prev ? { ...prev, ...p } : prev));
  const setExp = (i: number, p: Partial<ExpDraft>) =>
    setEx((prev) =>
      prev
        ? {
            ...prev,
            experiences: prev.experiences.map((e, idx) => (idx === i ? { ...e, ...p } : e)),
          }
        : prev,
    );
  const setEdu = (i: number, p: Partial<EduDraft>) =>
    setEx((prev) =>
      prev
        ? { ...prev, education: prev.education.map((e, idx) => (idx === i ? { ...e, ...p } : e)) }
        : prev,
    );

  // Ask the API's AI extractor to identify every field; fall back to the
  // heuristic parser if the AI is unavailable.
  const runExtraction = async (text: string) => {
    setBusy('ai');
    try {
      const res = await fetch(`${API_BASE}/v1/me/resume/extract`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 20000) }),
      });
      const json = (await res.json()) as { ok?: boolean; data?: { extracted?: unknown } };
      if (json.ok && json.data?.extracted) {
        setEx(fromApiExtraction(json.data.extracted));
        setEngine('ai');
        toast.success(dt('Identified every section — review and import below'));
        return;
      }
      throw new Error('no ai');
    } catch {
      setEx(parseResumeText(text));
      setEngine('basic');
      toast.success(dt('Basic extraction ready — review and import below'));
    } finally {
      setBusy(null);
    }
  };

  const applyText = (text: string) => {
    setRaw(text);
    void runExtraction(text);
  };

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
        data?: { text?: string; extracted?: unknown };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok || !json.data?.text) {
        throw new Error(json.error?.message || dt('Could not read that file'));
      }
      setRaw(json.data.text);
      if (json.data.extracted) {
        setEx(fromApiExtraction(json.data.extracted));
        setEngine('ai');
        toast.success(dt('Identified every section — review and import below'));
      } else {
        await runExtraction(json.data.text);
      }
    } catch (err) {
      toast.error((err as Error).message || dt('Could not read that file'));
    } finally {
      fileBusy.current = false;
      setBusy(null);
    }
  };

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
      applyText(text);
    } catch (err) {
      toast.error((err as Error).message || dt('Could not read that photo'));
    } finally {
      fileBusy.current = false;
      setBusy(null);
    }
  };

  const fillFromProfile = () => {
    const headline = (me?.title ?? '').slice(0, 120);
    const summary = (me?.bio ?? '').slice(0, 2000);
    if (!headline && !summary) {
      return toast.error(dt('Your profile has no title or bio yet — add them first'));
    }
    setRaw([headline, summary].filter(Boolean).join('\n\n'));
    setEx({
      name: me?.fullName ?? null,
      headline,
      targetRole: '',
      summary,
      email: me?.email ?? '',
      phone: me?.phone ?? '',
      city: me?.city ?? '',
      website: '',
      linkedin: '',
      github: '',
      skills: [],
      languages: [],
      achievements: '',
      interests: [],
      experiences: [],
      education: [],
      certifications: [],
      projects: [],
    });
    setEngine('basic');
    toast.success(dt('Prefilled from your profile — review it below'));
  };

  // ---------------- import: everything goes to its correct place ----------------
  const importData = async () => {
    if (!ex || !resume) return;
    if (importing) return;
    setImporting(true);
    try {
      // -- sanitizers: nothing invalid ever reaches the API (a single bad
      //    email/URL would 400 the WHOLE update and import nothing) --
      const clamp = (v: string, n: number) => v.trim().slice(0, n);
      const sanitizeUrl = (v: string): string | null => {
        let t = v.trim().replace(/\s+/g, '');
        if (!t) return null;
        t = t.replace(/[.,;)\]]+$/, '');
        if (!/^https?:\/\//i.test(t)) t = `https://${t}`;
        if (!/^[\x21-\x7E]+$/.test(t)) return null;
        try {
          const u = new URL(t);
          if (!u.hostname.includes('.')) return null;
          return t.slice(0, 300);
        } catch {
          return null;
        }
      };
      const sanitizeEmail = (v: string): string | null => {
        const t = v.trim().slice(0, 200);
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t : null;
      };

      const rc = resume.content ?? {
        skills: [],
        projects: [],
        achievements: [],
        volunteer: [],
        publications: [],
        references: [],
      };
      const summaryFinal = (
        ex.interests.length > 0
          ? `${ex.summary}\n\nInterests: ${ex.interests.join(' · ')}`
          : ex.summary
      )
        .trim()
        .slice(0, 2000);

      // 1) Resume core + contact + skills/achievements/projects/languages.
      //    updateResume rewrites every field, so this is ONE merged body;
      //    every value is sanitized (or falls back to the stored one).
      const existingSkills = new Set(rc.skills.map((sk) => sk.name.toLowerCase()));
      const mergedSkills = [...rc.skills];
      for (const name of ex.skills) {
        const key = name.toLowerCase();
        if (name.length >= 2 && !existingSkills.has(key)) {
          existingSkills.add(key);
          mergedSkills.push({ name: name.slice(0, 60), level: 3 });
        }
      }
      const existingAch = new Set(rc.achievements.map((a) => a.toLowerCase()));
      const newAch = ex.achievements
        .split('\n')
        .map((line) => line.trim().slice(0, 240))
        .filter((line) => line.length >= 2 && !existingAch.has(line.toLowerCase()));
      const newProjects = ex.projects
        .filter((p) => p.title.trim().length >= 2)
        .map((p) => ({
          title: p.title.trim().slice(0, 120),
          description: p.description.trim().slice(0, 1600) || null,
          role: null,
          url: null,
          technologies: [],
          highlights: [],
          startYear: null,
          endYear: null,
        }));
      const content: ResumeContent = {
        skills: mergedSkills.slice(0, 40),
        projects: [...(rc.projects ?? []), ...newProjects].slice(0, 20),
        achievements: [...(rc.achievements ?? []), ...newAch].slice(0, 20),
        volunteer: rc.volunteer ?? [],
        publications: rc.publications ?? [],
        references: rc.references ?? [],
      };
      const languages = [
        ...new Set([...resume.languages, ...ex.languages.map((l) => l.slice(0, 60))]),
      ].slice(0, 15);
      const urlOrKeep = (next: string, existing: string | null): string | undefined =>
        sanitizeUrl(next) ?? (existing && sanitizeUrl(existing) ? existing : undefined);
      const emailOrKeep = (next: string, existing: string | null): string | undefined =>
        sanitizeEmail(next) ?? (existing && sanitizeEmail(existing) ? existing : undefined);

      await update.mutateAsync({
        headline: clamp(ex.headline, 120) || resume.headline,
        summary: summaryFinal || resume.summary,
        phone: clamp(ex.phone, 40) || resume.phone,
        email: emailOrKeep(ex.email, resume.email),
        city: clamp(ex.city, 80) || resume.city,
        website: urlOrKeep(ex.website, resume.website),
        linkedin: urlOrKeep(ex.linkedin, resume.linkedin),
        github: urlOrKeep(ex.github, resume.github),
        targetRole: clamp(ex.targetRole, 120) || resume.targetRole,
        languages,
        theme: resume.theme,
        content,
      });

      // 2) Work experience — one row per entry, in CV order
      const yearMax = new Date().getFullYear() + 1;
      const validYear = (y: number | null): y is number => y !== null && y >= 1950 && y <= yearMax;
      let addedExp = 0;
      let skipped = 0;
      for (let i = 0; i < ex.experiences.length; i += 1) {
        const e = ex.experiences[i];
        if (!e) continue;
        const company = e.company.trim().slice(0, 120);
        const role = e.role.trim().slice(0, 120);
        const startYear = Number(e.startYear.replace(/[^0-9]/g, ''));
        if (!company || !role || !validYear(startYear || null)) {
          skipped += 1;
          continue;
        }
        const startMonth = Math.min(12, Math.max(1, Number(e.startMonth) || 1));
        let endYear = e.current || !e.endYear ? null : Number(e.endYear) || null;
        let endMonth =
          e.current || !e.endMonth ? null : Math.min(12, Math.max(1, Number(e.endMonth) || 1));
        // Schema invariant: end >= start — otherwise treat the role as current.
        if (
          validYear(endYear) &&
          endMonth !== null &&
          endYear * 12 + endMonth < startYear * 12 + startMonth
        ) {
          endYear = null;
          endMonth = null;
          setExp(i, { current: true, endYear: '', endMonth: '' });
        }
        try {
          await addExperience.mutateAsync({
            company,
            role,
            location: e.location.trim().slice(0, 120) || null,
            startYear,
            startMonth,
            endYear: validYear(endYear) ? endYear : null,
            endMonth,
            description: e.description.trim().slice(0, 2000) || null,
          });
          addedExp += 1;
        } catch (err) {
          console.error('experience row failed', err);
          skipped += 1;
        }
      }

      // 3) Education
      let addedEdu = 0;
      for (const d of ex.education) {
        const school = d.school.trim().slice(0, 120);
        if (!school) {
          skipped += 1;
          continue;
        }
        const endYearRaw = Number(d.endYear.replace(/[^0-9]/g, '')) || null;
        const endYear = validYear(endYearRaw) ? endYearRaw : null;
        const startYearRaw =
          Number(d.startYear.replace(/[^0-9]/g, '')) || endYear || new Date().getFullYear() - 4;
        const startYear = validYear(startYearRaw) ? startYearRaw : new Date().getFullYear() - 4;
        try {
          await addEducation.mutateAsync({
            school,
            degree: d.degree.trim().slice(0, 120) || null,
            fieldOfStudy: d.fieldOfStudy.trim().slice(0, 120) || null,
            startYear,
            endYear,
            description: d.description.trim().slice(0, 1000) || null,
          });
          addedEdu += 1;
        } catch (err) {
          console.error('education row failed', err);
          skipped += 1;
        }
      }

      // 4) Certifications
      let addedCert = 0;
      for (const c of ex.certifications) {
        const name = c.name.trim().slice(0, 160);
        const issuer = c.issuer.trim().slice(0, 160);
        const issueYear = Number(c.issueYear.replace(/[^0-9]/g, ''));
        if (!name || !issuer || !validYear(issueYear || null)) {
          skipped += 1;
          continue;
        }
        try {
          await addCertification.mutateAsync({ name, issuer, issueYear });
          addedCert += 1;
        } catch (err) {
          console.error('certification row failed', err);
          skipped += 1;
        }
      }

      // 5) Optionally mirror the headline/summary onto the Apex profile
      if (alsoProfile && (ex.headline.trim() || summaryFinal)) {
        try {
          await fetch(`${API_BASE}/v1/me`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: ex.headline.trim().slice(0, 120) || null,
              bio: summaryFinal || null,
            }),
          });
        } catch {
          /* profile sync is best-effort */
        }
      }

      toast.success(
        `${dt('Imported into Resume Studio')} · ${addedExp} ${dt('experience')}, ${addedEdu} ${dt('education')}, ${addedCert} ${dt('certifications')}`,
      );
      if (skipped > 0) {
        toast.info(
          dt(`{count} entries skipped — check dates and required fields`, { count: skipped }),
        );
      }
      router.push('/resume');
    } catch (error) {
      console.error('import failed', error);
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };
  if (meLoading || resumeLoading || !me)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (!isAuthed) return null;

  const inputCls =
    'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary';
  const labelCls =
    'mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground';

  return (
    <div className="min-h-dvh bg-background pb-12">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => safeBack(router)}
          aria-label={dt('Go back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{dt('Import CV')}</h1>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pt-4">
        <p className="text-sm text-muted-foreground">
          {dt(
            'Upload your CV and every detail — name, contact, experience, education, skills, certifications, languages, hobbies — is identified and filed into the right place. You review everything before it saves.',
          )}
        </p>

        <section className="mt-4 rounded-2xl border border-border bg-card p-5">
          {/* Fast paths: file, profile, photo. */}
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
          <div className="text-xs font-semibold text-muted-foreground">
            {dt('…or paste your CV / LinkedIn text:')}
          </div>
          <textarea
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            rows={8}
            placeholder={
              'Paste your text here…\n\nJohn Doe\nFrontend Developer\n\nSummary\nI build…\n\nExperience\nSoftware Engineer — Acme Corp, Addis Ababa (2021 – Present)…'
            }
            className="mt-2 min-h-[180px] w-full rounded-2xl border border-border bg-background p-4 text-sm leading-relaxed outline-none focus:border-primary"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="brand"
              onClick={() => void runExtraction(raw)}
              disabled={busy !== null || raw.trim().length < 20}
            >
              {busy === 'ai' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {busy === 'ai' ? dt('Identifying sections…') : dt('Identify & prepare import')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={importData}
              disabled={!ready || importing}
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileInput className="h-4 w-4" />
              )}
              {importing ? dt('Importing…') : dt('Import to my CV')}
            </Button>
          </div>
        </section>

        {ex && (
          <>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs font-semibold text-primary">
                {engine === 'ai'
                  ? dt('✨ AI identified your CV — review each section, then import.')
                  : dt('Basic extraction ready — check the sections, then import.')}
              </p>
              {engine === 'basic' && (
                <button
                  type="button"
                  onClick={() => void runExtraction(raw)}
                  className="shrink-0 text-xs font-bold text-primary underline"
                >
                  {dt('Try AI')}
                </button>
              )}
            </div>

            {/* Contact */}
            <Section icon={<Mail className="h-3.5 w-3.5" />} title={dt('Contact')}>
              {ex.name && (
                <p className="mb-2 text-xs text-muted-foreground">
                  {dt('Detected name')}:{' '}
                  <span className="font-bold text-foreground">{ex.name}</span> ·{' '}
                  <Link href="/settings/profile" className="font-semibold text-primary underline">
                    {dt('lives on your Apex account')}
                  </Link>
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <span className={labelCls}>{dt('Email')}</span>
                  <input
                    className={inputCls}
                    value={ex.email}
                    onChange={(e) => patch({ email: e.target.value })}
                  />
                </div>
                <div>
                  <span className={labelCls}>{dt('Phone')}</span>
                  <input
                    className={inputCls}
                    value={ex.phone}
                    onChange={(e) => patch({ phone: e.target.value })}
                  />
                </div>
                <div>
                  <span className={labelCls}>{dt('City')}</span>
                  <input
                    className={inputCls}
                    value={ex.city}
                    onChange={(e) => patch({ city: e.target.value })}
                  />
                </div>
                <div>
                  <span className={labelCls}>{dt('Website')}</span>
                  <input
                    className={inputCls}
                    value={ex.website}
                    onChange={(e) => patch({ website: e.target.value })}
                  />
                </div>
                <div>
                  <span className={labelCls}>LinkedIn</span>
                  <input
                    className={inputCls}
                    value={ex.linkedin}
                    onChange={(e) => patch({ linkedin: e.target.value })}
                  />
                </div>
                <div>
                  <span className={labelCls}>GitHub</span>
                  <input
                    className={inputCls}
                    value={ex.github}
                    onChange={(e) => patch({ github: e.target.value })}
                  />
                </div>
              </div>
            </Section>

            {/* Headline / summary */}
            <Section icon={<FileText className="h-3.5 w-3.5" />} title={dt('Headline & summary')}>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <span className={labelCls}>{dt('Headline')}</span>
                  <input
                    className={inputCls}
                    value={ex.headline}
                    onChange={(e) => patch({ headline: e.target.value })}
                  />
                </div>
                <div>
                  <span className={labelCls}>{dt('Target role')}</span>
                  <input
                    className={inputCls}
                    value={ex.targetRole}
                    onChange={(e) => patch({ targetRole: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-2">
                <span className={labelCls}>{dt('Summary')}</span>
                <textarea
                  className={inputCls}
                  rows={4}
                  value={ex.summary}
                  onChange={(e) => patch({ summary: e.target.value })}
                />
              </div>
            </Section>

            {/* Experience */}
            <Section
              icon={<Briefcase className="h-3.5 w-3.5" />}
              title={`${dt('Experience')} · ${ex.experiences.length}`}
            >
              {ex.experiences.map((e, i) => (
                <div
                  key={i}
                  className="relative mt-2 rounded-xl border border-border bg-background p-3 first:mt-0"
                >
                  <button
                    type="button"
                    aria-label={dt('Remove')}
                    onClick={() =>
                      patch({ experiences: ex.experiences.filter((_, idx) => idx !== i) })
                    }
                    className="absolute right-2 top-2 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      className={inputCls}
                      placeholder={dt('Company')}
                      value={e.company}
                      onChange={(ev) => setExp(i, { company: ev.target.value })}
                    />
                    <input
                      className={inputCls}
                      placeholder={dt('Role')}
                      value={e.role}
                      onChange={(ev) => setExp(i, { role: ev.target.value })}
                    />
                    <input
                      className={inputCls}
                      placeholder={dt('Location')}
                      value={e.location}
                      onChange={(ev) => setExp(i, { location: ev.target.value })}
                    />
                    <div className="grid grid-cols-3 gap-1.5">
                      <input
                        className={inputCls}
                        placeholder={dt('Start yr')}
                        value={e.startYear}
                        onChange={(ev) =>
                          setExp(i, {
                            startYear: ev.target.value.replace(/[^0-9]/g, '').slice(0, 4),
                          })
                        }
                      />
                      <select
                        className={inputCls}
                        value={e.startMonth}
                        onChange={(ev) => setExp(i, { startMonth: ev.target.value })}
                      >
                        {MONTHS.map((m, idx) => (
                          <option key={m} value={String(idx + 1)}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-[11px] font-semibold">
                        <input
                          type="checkbox"
                          checked={e.current}
                          onChange={(ev) => setExp(i, { current: ev.target.checked })}
                          className="h-4 w-4"
                        />
                        {dt('Current')}
                      </label>
                    </div>
                    {!e.current && (
                      <div className="grid grid-cols-2 gap-1.5 sm:col-span-2">
                        <input
                          className={inputCls}
                          placeholder={dt('End yr')}
                          value={e.endYear}
                          onChange={(ev) =>
                            setExp(i, {
                              endYear: ev.target.value.replace(/[^0-9]/g, '').slice(0, 4),
                            })
                          }
                        />
                        <select
                          className={inputCls}
                          value={e.endMonth}
                          onChange={(ev) => setExp(i, { endMonth: ev.target.value })}
                        >
                          <option value="">{dt('Month…')}</option>
                          {MONTHS.map((m, idx) => (
                            <option key={m} value={String(idx + 1)}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <textarea
                    className={`${inputCls} mt-2`}
                    rows={2}
                    placeholder={dt('What you did there…')}
                    value={e.description}
                    onChange={(ev) => setExp(i, { description: ev.target.value })}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  patch({
                    experiences: [
                      ...ex.experiences,
                      {
                        company: '',
                        role: '',
                        location: '',
                        startYear: emptyYear,
                        startMonth: '1',
                        endYear: '',
                        endMonth: '',
                        current: true,
                        description: '',
                      },
                    ],
                  })
                }
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-xs font-bold text-muted-foreground hover:border-primary/50 hover:text-primary"
              >
                <Plus className="h-3.5 w-3.5" /> {dt('Add experience')}
              </button>
            </Section>

            {/* Education */}
            <Section
              icon={<GraduationCap className="h-3.5 w-3.5" />}
              title={`${dt('Education')} · ${ex.education.length}`}
            >
              {ex.education.map((d, i) => (
                <div
                  key={i}
                  className="relative mt-2 rounded-xl border border-border bg-background p-3 first:mt-0"
                >
                  <button
                    type="button"
                    aria-label={dt('Remove')}
                    onClick={() => patch({ education: ex.education.filter((_, idx) => idx !== i) })}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      className={inputCls}
                      placeholder={dt('School / university')}
                      value={d.school}
                      onChange={(ev) => setEdu(i, { school: ev.target.value })}
                    />
                    <input
                      className={inputCls}
                      placeholder={dt('Degree')}
                      value={d.degree}
                      onChange={(ev) => setEdu(i, { degree: ev.target.value })}
                    />
                    <input
                      className={inputCls}
                      placeholder={dt('Field of study')}
                      value={d.fieldOfStudy}
                      onChange={(ev) => setEdu(i, { fieldOfStudy: ev.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        className={inputCls}
                        placeholder={dt('Start yr')}
                        value={d.startYear}
                        onChange={(ev) =>
                          setEdu(i, {
                            startYear: ev.target.value.replace(/[^0-9]/g, '').slice(0, 4),
                          })
                        }
                      />
                      <input
                        className={inputCls}
                        placeholder={dt('End yr')}
                        value={d.endYear}
                        onChange={(ev) =>
                          setEdu(i, { endYear: ev.target.value.replace(/[^0-9]/g, '').slice(0, 4) })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  patch({
                    education: [
                      ...ex.education,
                      {
                        school: '',
                        degree: '',
                        fieldOfStudy: '',
                        startYear: emptyYear,
                        endYear: '',
                        description: '',
                      },
                    ],
                  })
                }
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-xs font-bold text-muted-foreground hover:border-primary/50 hover:text-primary"
              >
                <Plus className="h-3.5 w-3.5" /> {dt('Add education')}
              </button>
            </Section>

            {/* Certifications */}
            <Section
              icon={<FileText className="h-3.5 w-3.5" />}
              title={`${dt('Certifications')} · ${ex.certifications.length}`}
            >
              {ex.certifications.map((c, i) => (
                <div key={i} className="mt-2 grid grid-cols-[1fr_1fr_5rem] gap-1.5 first:mt-0">
                  <input
                    className={inputCls}
                    placeholder={dt('Name')}
                    value={c.name}
                    onChange={(ev) =>
                      setEx((prev) =>
                        prev
                          ? {
                              ...prev,
                              certifications: prev.certifications.map((x, idx) =>
                                idx === i ? { ...x, name: ev.target.value } : x,
                              ),
                            }
                          : prev,
                      )
                    }
                  />
                  <input
                    className={inputCls}
                    placeholder={dt('Issuer')}
                    value={c.issuer}
                    onChange={(ev) =>
                      setEx((prev) =>
                        prev
                          ? {
                              ...prev,
                              certifications: prev.certifications.map((x, idx) =>
                                idx === i ? { ...x, issuer: ev.target.value } : x,
                              ),
                            }
                          : prev,
                      )
                    }
                  />
                  <input
                    className={inputCls}
                    placeholder={dt('Year')}
                    value={c.issueYear}
                    onChange={(ev) =>
                      setEx((prev) =>
                        prev
                          ? {
                              ...prev,
                              certifications: prev.certifications.map((x, idx) =>
                                idx === i
                                  ? {
                                      ...x,
                                      issueYear: ev.target.value.replace(/[^0-9]/g, '').slice(0, 4),
                                    }
                                  : x,
                              ),
                            }
                          : prev,
                      )
                    }
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  patch({
                    certifications: [
                      ...ex.certifications,
                      { name: '', issuer: '', issueYear: emptyYear },
                    ],
                  })
                }
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-xs font-bold text-muted-foreground hover:border-primary/50 hover:text-primary"
              >
                <Plus className="h-3.5 w-3.5" /> {dt('Add certification')}
              </button>
            </Section>

            {/* Skills / languages / interests */}
            <Section icon={<Sparkles className="h-3.5 w-3.5" />} title={dt('Skills & languages')}>
              <span className={labelCls}>
                {dt('Skills')} · {ex.skills.length}
              </span>
              <Chips
                items={ex.skills}
                onRemove={(item) => patch({ skills: ex.skills.filter((s) => s !== item) })}
              />
              <div className="mt-2 flex gap-1.5">
                <input
                  id="skill-add"
                  className={inputCls}
                  placeholder={dt('Add a skill…')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const v = (e.target as HTMLInputElement).value.trim().slice(0, 60);
                      if (v && !ex.skills.some((s) => s.toLowerCase() === v.toLowerCase()))
                        patch({ skills: [...ex.skills, v] });
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
              </div>
              <span className={`${labelCls} mt-3`}>{dt('Languages')}</span>
              <Chips
                items={ex.languages}
                onRemove={(item) => patch({ languages: ex.languages.filter((s) => s !== item) })}
              />
              <span className={`${labelCls} mt-3`}>
                {dt('Hobbies & interests')} — {dt('added to your summary')}
              </span>
              <Chips
                items={ex.interests}
                onRemove={(item) => patch({ interests: ex.interests.filter((s) => s !== item) })}
              />
            </Section>

            {/* Achievements */}
            {(ex.achievements.length > 0 || engine === 'ai') && (
              <Section
                icon={<FileText className="h-3.5 w-3.5" />}
                title={dt('Achievements — one per line')}
              >
                <textarea
                  className={inputCls}
                  rows={3}
                  value={ex.achievements}
                  onChange={(e) => patch({ achievements: e.target.value })}
                />
              </Section>
            )}

            {/* Import + profile mirror */}
            <div className="mt-4 rounded-2xl border border-border bg-card p-4">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={alsoProfile}
                  onChange={(e) => setAlsoProfile(e.target.checked)}
                  className="h-4 w-4"
                />
                {dt('Also update my Apex profile (title & bio)')}
              </label>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {dt(
                  'Import is additive: existing content stays, duplicates are skipped. Experience, education and certifications are added as new entries.',
                )}
              </p>
              <Button
                type="button"
                variant="brand"
                className="mt-3 w-full"
                onClick={importData}
                disabled={importing}
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {importing ? dt('Importing…') : dt('Import everything to my CV')}
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
