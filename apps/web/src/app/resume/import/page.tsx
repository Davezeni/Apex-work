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
import { useQueryClient } from '@tanstack/react-query';
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
import type { Resume } from '@/hooks/use-resume';
import {
  parseResumeHeuristic,
  certificationSchema,
  educationSchema,
  resumeSchema,
  workExperienceSchema,
  type ResumeContent,
} from '@apex-work/shared';
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
  const queryClient = useQueryClient();

  const fileBusy = useRef(false);
  const [busy, setBusy] = useState<'file' | 'ocr' | 'ai' | null>(null);
  const [raw, setRaw] = useState('');
  const [ex, setEx] = useState<Extracted | null>(null);
  const [engine, setEngine] = useState<'ai' | 'basic' | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [alsoProfile, setAlsoProfile] = useState(true);
  const [alsoName, setAlsoName] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; title: string; lines: string[] } | null>(
    null,
  );

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
  // shared deterministic parser (and say WHY) if the AI is unavailable.
  const runExtraction = async (text: string) => {
    setBusy('ai');
    try {
      const res = await fetch(`${API_BASE}/v1/me/resume/extract`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 20000) }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { extracted?: unknown; engine?: string; aiNote?: string | null };
      };
      if (json.ok && json.data?.extracted) {
        setEx(fromApiExtraction(json.data.extracted));
        setEngine('ai');
        setAiNote(null);
        toast.success(dt('Identified every section — review and import below'));
        return;
      }
      applyBasicExtraction(text, json.data?.aiNote ?? null);
    } catch {
      applyBasicExtraction(text, 'AI_ERROR: network');
    } finally {
      setBusy(null);
    }
  };

  const applyBasicExtraction = (text: string, note: string | null) => {
    setEx(fromApiExtraction(parseResumeHeuristic(text)));
    setEngine('basic');
    setAiNote(note);
    toast.success(dt('Smart text extraction ready — review and import below'));
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
        data?: { text?: string; extracted?: unknown; engine?: string; aiNote?: string | null };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok || !json.data?.text) {
        throw new Error(json.error?.message || dt('Could not read that file'));
      }
      setRaw(json.data.text);
      if (json.data.extracted) {
        setEx(fromApiExtraction(json.data.extracted));
        setEngine('ai');
        setAiNote(null);
        toast.success(dt('Identified every section — review and import below'));
      } else {
        // second chance: the dedicated AI route (service retries internally)
        try {
          const retry = await fetch(`${API_BASE}/v1/me/resume/extract`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: json.data.text.slice(0, 20000) }),
          });
          const retryJson = (await retry.json()) as {
            ok?: boolean;
            data?: { extracted?: unknown; aiNote?: string | null };
          };
          if (retryJson.ok && retryJson.data?.extracted) {
            setEx(fromApiExtraction(retryJson.data.extracted));
            setEngine('ai');
            setAiNote(null);
            toast.success(dt('Identified every section — review and import below'));
            return;
          }
          applyBasicExtraction(json.data.text, retryJson.data?.aiNote ?? json.data.aiNote ?? null);
        } catch {
          applyBasicExtraction(json.data.text, json.data.aiNote ?? null);
        }
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
    if (!ex || importing) return;
    setResult(null);
    if (!resume) {
      const msg = dt('Your CV failed to load — refresh the page and try again');
      setResult({ ok: false, title: msg, lines: [] });
      toast.error(msg);
      return;
    }
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
      const beforeExp = resume.experiences.length;
      const beforeEdu = resume.education.length;
      const beforeCert = resume.certifications.length;
      // Duplicate guards: re-running an import must never create duplicates.
      const expKeys = new Set(
        resume.experiences.map(
          (r) => `${r.company.toLowerCase()}|${r.role.toLowerCase()}|${r.startYear}`,
        ),
      );
      const eduKeys = new Set(
        resume.education.map(
          (r) => `${r.school.toLowerCase()}|${r.degree?.toLowerCase() ?? ''}|${r.startYear}`,
        ),
      );
      const certKeys = new Set(
        resume.certifications.map(
          (r) => `${r.name.toLowerCase()}|${r.issuer.toLowerCase()}|${r.issueYear}`,
        ),
      );

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
      const newSkillsCount = mergedSkills.length - rc.skills.length;
      const existingAch = new Set(rc.achievements.map((a) => a.toLowerCase()));
      const newAch = ex.achievements
        .split('\n')
        .map((line) => line.trim().slice(0, 240))
        .filter((line) => line.length >= 2 && !existingAch.has(line.toLowerCase()));
      const newLanguagesCount = ex.languages.filter(
        (l) =>
          l.length >= 1 && !resume.languages.map((x) => x.toLowerCase()).includes(l.toLowerCase()),
      ).length;
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

      const finalHeadline = clamp(ex.headline, 120) || resume.headline;
      // Pre-validate with the API's own schema and strip anything that would
      // 400 — "Validation failed" must never kill a whole import. If the
      // merged content is the problem, retry once without it (rows below
      // still import through their own endpoints).
      const buildBody = (withContent: boolean) => ({
        headline: finalHeadline,
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
        ...(withContent ? { content } : {}),
      });
      let core = resumeSchema.safeParse(buildBody(true));
      if (!core.success) core = resumeSchema.safeParse(buildBody(false));
      if (!core.success) throw new Error('Nothing in the import could be validated');
      await update.mutateAsync(core.data);

      // 2) Work experience — one row per entry, in CV order
      const yearMax = new Date().getFullYear() + 1;
      const validYear = (y: number | null): y is number => y !== null && y >= 1950 && y <= yearMax;
      let addedExp = 0;
      let dupeExp = 0;
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
        const key = `${company.toLowerCase()}|${role.toLowerCase()}|${startYear}`;
        if (expKeys.has(key)) {
          dupeExp += 1;
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
        const row = workExperienceSchema.safeParse({
          company,
          role,
          location: e.location.trim().slice(0, 120) || null,
          startYear,
          startMonth,
          endYear: validYear(endYear) ? endYear : null,
          endMonth,
          description: e.description.trim().slice(0, 2000) || null,
        });
        if (!row.success) {
          skipped += 1;
          continue;
        }
        try {
          await addExperience.mutateAsync(row.data);
          expKeys.add(key);
          addedExp += 1;
        } catch (err) {
          console.error('experience row failed', err);
          skipped += 1;
        }
      }

      // 3) Education
      let addedEdu = 0;
      let dupeEdu = 0;
      for (const d of ex.education) {
        const school = d.school.trim().slice(0, 120);
        if (!school) {
          skipped += 1;
          continue;
        }
        const endYearRaw = Number(d.endYear.replace(/[^0-9]/g, '')) || null;
        const endYear = validYear(endYearRaw) ? endYearRaw : null;
        // Honest years only: the CV (or the user fixing the box below) must
        // supply one. A blank year is NEVER defaulted to "current year - 4".
        const startYearRaw = Number(d.startYear.replace(/[^0-9]/g, '')) || endYear;
        if (!validYear(startYearRaw)) {
          skipped += 1;
          continue;
        }
        const startYear: number = startYearRaw;
        const key = `${school.toLowerCase()}|${d.degree.trim().toLowerCase()}|${startYear}`;
        if (eduKeys.has(key)) {
          dupeEdu += 1;
          continue;
        }
        const row = educationSchema.safeParse({
          school,
          degree: d.degree.trim().slice(0, 120) || null,
          fieldOfStudy: d.fieldOfStudy.trim().slice(0, 120) || null,
          startYear,
          endYear,
          description: d.description.trim().slice(0, 1000) || null,
        });
        if (!row.success) {
          skipped += 1;
          continue;
        }
        try {
          await addEducation.mutateAsync(row.data);
          eduKeys.add(key);
          addedEdu += 1;
        } catch (err) {
          console.error('education row failed', err);
          skipped += 1;
        }
      }

      // 4) Certifications
      let addedCert = 0;
      let dupeCert = 0;
      for (const c of ex.certifications) {
        const name = c.name.trim().slice(0, 160);
        const issuer = c.issuer.trim().slice(0, 160);
        const issueYear = Number(c.issueYear.replace(/[^0-9]/g, ''));
        if (!name || !issuer || !validYear(issueYear || null)) {
          skipped += 1;
          continue;
        }
        const key = `${name.toLowerCase()}|${issuer.toLowerCase()}|${issueYear}`;
        if (certKeys.has(key)) {
          dupeCert += 1;
          continue;
        }
        const row = certificationSchema.safeParse({ name, issuer, issueYear });
        if (!row.success) {
          skipped += 1;
          continue;
        }
        try {
          await addCertification.mutateAsync(row.data);
          certKeys.add(key);
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

        // 5b) Override the account name with the name from the CV (explicit
        // opt-in checkbox below; kills the "two different names" problem).
        if (alsoName && ex.name && ex.name.trim().length >= 2) {
          try {
            await fetch(`${API_BASE}/v1/me`, {
              method: 'PATCH',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ fullName: ex.name.trim().slice(0, 80) }),
            });
            queryClient.invalidateQueries({ queryKey: ['me'] });
          } catch {
            /* name sync is best-effort */
          }
        }
      }

      // 6) VERIFY against the server: refetch the CV and confirm it all landed.
      await queryClient.invalidateQueries({ queryKey: ['me', 'resume'] });
      const fresh = queryClient.getQueryData<Resume>(['me', 'resume']);
      const rowsOk =
        !!fresh &&
        fresh.experiences.length >= beforeExp + addedExp &&
        fresh.education.length >= beforeEdu + addedEdu &&
        fresh.certifications.length >= beforeCert + addedCert;
      const coreOk = !finalHeadline || !!fresh?.headline || !ex.headline.trim();

      const lines: string[] = [];
      if (ex.headline.trim() || summaryFinal) lines.push(dt('Headline & summary'));
      if (
        ex.phone.trim() ||
        ex.email.trim() ||
        ex.city.trim() ||
        ex.website.trim() ||
        ex.linkedin.trim() ||
        ex.github.trim()
      )
        lines.push(dt('Contact details'));
      if (newSkillsCount > 0) lines.push(`${newSkillsCount} ${dt('skills')}`);
      if (newLanguagesCount > 0) lines.push(`${newLanguagesCount} ${dt('languages')}`);
      if (newAch.length > 0) lines.push(`${newAch.length} ${dt('achievements')}`);
      if (newProjects.length > 0) lines.push(`${newProjects.length} ${dt('projects')}`);
      if (addedExp > 0 || dupeExp > 0)
        lines.push(
          `${addedExp} ${dt('experience entries')}${dupeExp > 0 ? ` · ${dupeExp} ${dt('already on your CV')}` : ''}`,
        );
      if (addedEdu > 0 || dupeEdu > 0)
        lines.push(
          `${addedEdu} ${dt('education entries')}${dupeEdu > 0 ? ` · ${dupeEdu} ${dt('already on your CV')}` : ''}`,
        );
      if (addedCert > 0 || dupeCert > 0)
        lines.push(
          `${addedCert} ${dt('certification entries')}${dupeCert > 0 ? ` · ${dupeCert} ${dt('already on your CV')}` : ''}`,
        );
      if (skipped > 0)
        lines.push(
          dt('{count} entries skipped — check dates and required fields').replace(
            '{count}',
            String(skipped),
          ),
        );

      const ok = rowsOk && coreOk;
      if (ok) {
        toast.success(dt('Imported into Resume Studio'));
      } else {
        toast.error(dt('Saved, but the server check failed — refresh the page and review your CV'));
      }
      setResult({
        ok,
        title: ok
          ? dt('Imported into your CV — verified on the server')
          : dt('Saved, but the server check failed — refresh the page and review your CV'),
        lines,
      });
    } catch (error) {
      console.error('import failed', error);
      const message = error instanceof Error ? error.message : 'Import failed';
      setResult({
        ok: false,
        title: message,
        lines: [
          dt(
            'Refresh the page and try again — anything already saved is skipped, so nothing duplicates.',
          ),
        ],
      });
      toast.error(message);
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
                  : dt('Smart text extraction ready — check the sections, then import.')}
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
              {engine === 'basic' && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {aiNote === 'AI_NOT_CONFIGURED'
                    ? dt(
                        'AI extraction is not enabled on the server yet (missing GROQ_API_KEY) — smart text parsing was used.',
                      )
                    : aiNote
                      ? dt(
                          `AI was unavailable (${'{'}note{'}'}) — smart text parsing was used.`,
                        ).replace('{note}', aiNote.slice(0, 60))
                      : dt('Smart text parsing was used.')}
                </p>
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

            {result && (
              <div
                className={`mt-4 rounded-2xl border p-4 ${
                  result.ok
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-destructive/40 bg-destructive/10'
                }`}
              >
                <p
                  className={`text-sm font-bold ${result.ok ? 'text-emerald-600' : 'text-destructive'}`}
                >
                  {result.ok ? '✓ ' : '⚠ '}
                  {result.title}
                </p>
                {result.lines.length > 0 && (
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                    {result.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
                {result.ok && (
                  <Button
                    type="button"
                    variant="brand"
                    className="mt-3"
                    onClick={() => router.push('/resume')}
                  >
                    <FileText className="h-4 w-4" /> {dt('View my CV')}
                  </Button>
                )}
              </div>
            )}

            {/* Import + profile mirror */}
            <div className="mt-4 rounded-2xl border border-border bg-card p-4">
              {ex.name && ex.name.trim().length >= 2 && (
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={alsoName}
                    onChange={(e) => setAlsoName(e.target.checked)}
                    className="h-4 w-4"
                  />
                  {dt('Use the CV name everywhere — replace my account name')}
                  <span className="font-normal text-muted-foreground">({ex.name})</span>
                </label>
              )}
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
