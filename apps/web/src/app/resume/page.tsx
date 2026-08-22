'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, Plus, Trash2, Edit2, Save, Sparkles, Eye, Briefcase, GraduationCap, Award, Cpu,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import {
  useMyResume, useUpdateResume,
  useAddExperience, useUpdateExperience, useDeleteExperience,
  useAddEducation, useUpdateEducation, useDeleteEducation,
  useAddCertification, useDeleteCertification,
  type Resume,
} from '@/hooks/use-resume';
import { useAIResumeEnhance } from '@/hooks/use-ai';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Resume/CV builder. Sections:
 *   - Basics (headline + summary + contact + socials)
 *   - Experience list (add/edit/delete)
 *   - Education list
 *   - Certifications list
 *   - Languages tags
 *   - Theme picker
 *   - "Enhance with AI" per-section
 *   - Preview → /resume/preview which renders a print-ready layout
 */
export default function ResumeBuilderPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: me, isLoading: meLoading, isAuthed } = useMe();
  const { data: resume, isLoading } = useMyResume();
  const update = useUpdateResume();
  const enhance = useAIResumeEnhance();

  useEffect(() => {
    if (!meLoading && !isAuthed) router.replace('/login?next=/resume');
  }, [meLoading, isAuthed, router]);

  const [basics, setBasics] = useState({
    headline: '', summary: '', phone: '', email: '', city: '',
    website: '', linkedin: '', github: '', languages: [] as string[],
    theme: 'classic' as 'classic' | 'modern' | 'minimal',
  });
  const [langInput, setLangInput] = useState('');
  const [aiTarget, setAiTarget] = useState<null | { section: 'summary' | 'experience' | 'education'; onApply: (s: string) => void }>(null);

  useEffect(() => {
    if (!resume) return;
    setBasics({
      headline: resume.headline ?? '',
      summary: resume.summary ?? '',
      phone: resume.phone ?? '',
      email: resume.email ?? '',
      city: resume.city ?? '',
      website: resume.website ?? '',
      linkedin: resume.linkedin ?? '',
      github: resume.github ?? '',
      languages: resume.languages ?? [],
      theme: resume.theme,
    });
  }, [resume]);

  if (isLoading || !me) {
    return <div className="grid min-h-dvh place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const saveBasics = async () => {
    try {
      await update.mutateAsync({
        headline: basics.headline || null,
        summary: basics.summary || null,
        phone: basics.phone || null,
        email: basics.email || null,
        city: basics.city || null,
        website: basics.website || null,
        linkedin: basics.linkedin || null,
        github: basics.github || null,
        languages: basics.languages,
        theme: basics.theme,
      });
      toast.success('Saved ✅');
    } catch (err) {
      toast.error((err as { message?: string }).message ?? 'Save failed');
    }
  };

  const runAI = async () => {
    if (!aiTarget) return;
    try {
      const src =
        aiTarget.section === 'summary' ? basics.summary : '';
      if (!src.trim()) return toast.error('Add some text first');
      const r = await enhance.mutateAsync({ section: aiTarget.section, text: src });
      aiTarget.onApply(r.text);
      toast.success(r.source === 'ai' ? 'Enhanced with AI ✨' : 'AI unavailable — kept original');
      setAiTarget(null);
    } catch (err) {
      toast.error((err as { message?: string }).message ?? 'AI failed');
    }
  };

  return (
    <div className="min-h-dvh bg-background pb-32">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} aria-label={t('common.back')} className="grid h-9 w-9 place-items-center rounded-full active:scale-90">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-extrabold tracking-tight">Resume / CV</h1>
          <div className="text-[10px] text-muted-foreground">Build once — export or share</div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/resume/preview"><Eye className="h-4 w-4" /> Preview</Link>
        </Button>
      </header>

      {/* Basics */}
      <Section title="Basics">
        <Field label="Headline">
          <input
            value={basics.headline}
            onChange={(e) => setBasics((s) => ({ ...s, headline: e.target.value }))}
            placeholder="Senior Full-stack Developer · 5+ yrs"
            className="input"
            maxLength={120}
          />
        </Field>
        <Field label="Summary" hint="1-2 short paragraphs. AI can polish this.">
          <textarea
            value={basics.summary}
            onChange={(e) => setBasics((s) => ({ ...s, summary: e.target.value }))}
            rows={5}
            maxLength={2000}
            className="input"
          />
          <button
            type="button"
            onClick={() => setAiTarget({ section: 'summary', onApply: (v) => setBasics((s) => ({ ...s, summary: v })) })}
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-primary"
          >
            <Sparkles className="h-3 w-3" /> Enhance with AI
          </button>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Phone"><input value={basics.phone} onChange={(e) => setBasics((s) => ({ ...s, phone: e.target.value }))} className="input" /></Field>
          <Field label="Email"><input value={basics.email} onChange={(e) => setBasics((s) => ({ ...s, email: e.target.value }))} type="email" className="input" /></Field>
          <Field label="City"><input value={basics.city} onChange={(e) => setBasics((s) => ({ ...s, city: e.target.value }))} className="input" /></Field>
          <Field label="Website"><input value={basics.website} onChange={(e) => setBasics((s) => ({ ...s, website: e.target.value }))} className="input" /></Field>
          <Field label="LinkedIn URL"><input value={basics.linkedin} onChange={(e) => setBasics((s) => ({ ...s, linkedin: e.target.value }))} className="input" /></Field>
          <Field label="GitHub URL"><input value={basics.github} onChange={(e) => setBasics((s) => ({ ...s, github: e.target.value }))} className="input" /></Field>
        </div>

        <Field label="Languages">
          <div className="flex gap-2">
            <input
              value={langInput}
              onChange={(e) => setLangInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && langInput.trim()) {
                  e.preventDefault();
                  if (basics.languages.length < 15 && !basics.languages.includes(langInput.trim())) {
                    setBasics((s) => ({ ...s, languages: [...s.languages, langInput.trim()] }));
                  }
                  setLangInput('');
                }
              }}
              placeholder="English (Fluent)"
              className="input flex-1"
            />
            <Button variant="outline" size="default" onClick={() => {
              if (langInput.trim() && basics.languages.length < 15) {
                setBasics((s) => ({ ...s, languages: [...s.languages, langInput.trim()] }));
                setLangInput('');
              }
            }}>Add</Button>
          </div>
          {basics.languages.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {basics.languages.map((l) => (
                <span key={l} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs">
                  {l}
                  <button onClick={() => setBasics((s) => ({ ...s, languages: s.languages.filter((x) => x !== l) }))} aria-label="Remove">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </Field>

        <Field label="Theme">
          <div className="grid grid-cols-3 gap-2">
            {(['classic', 'modern', 'minimal'] as const).map((th) => (
              <button
                key={th}
                onClick={() => setBasics((s) => ({ ...s, theme: th }))}
                className={cn('rounded-xl border-2 px-3 py-3 text-xs font-semibold capitalize', basics.theme === th ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card')}
              >
                {th}
              </button>
            ))}
          </div>
        </Field>

        <Button variant="brand" size="lg" className="w-full" onClick={saveBasics} disabled={update.isPending}>
          {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Save basics</>}
        </Button>
      </Section>

      {/* Experience */}
      <ExperienceSection resume={resume} />
      {/* Education */}
      <EducationSection resume={resume} />
      {/* Certifications */}
      <CertificationSection resume={resume} />

      {/* AI confirm dialog */}
      {aiTarget && (
        <div className="fixed inset-0 z-[100] grid place-items-end bg-black/60 backdrop-blur-sm sm:place-items-center" onClick={() => setAiTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl border border-b-0 border-border bg-card p-6 sm:rounded-3xl">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted sm:hidden" />
            <div className="flex items-center gap-2 text-sm font-bold"><Cpu className="h-4 w-4 text-primary" /> Enhance with AI</div>
            <p className="mt-2 text-xs text-muted-foreground">
              We&rsquo;ll send your current text to our AI editor and replace it with a polished version. Nothing is saved until you tap &ldquo;Save basics&rdquo;.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="lg" className="flex-1" onClick={() => setAiTarget(null)}>Cancel</Button>
              <Button variant="brand" size="lg" className="flex-1" onClick={runAI} disabled={enhance.isPending}>
                {enhance.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4" /> Enhance</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 12px;
          border: 1px solid hsl(var(--border));
          background-color: hsl(var(--card));
          padding: 10px 12px;
          font-size: 14px;
          outline: none;
        }
        .input:focus {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 4px hsl(var(--primary) / 0.2);
        }
        textarea.input { resize: vertical; }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mx-3 mt-4 space-y-3 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-extrabold uppercase tracking-widest text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// EXPERIENCE
// -----------------------------------------------------------------------------
function ExperienceSection({ resume }: { resume: Resume | undefined }) {
  const add = useAddExperience();
  const upd = useUpdateExperience();
  const del = useDeleteExperience();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState({
    company: '', role: '', location: '', startYear: new Date().getFullYear(), startMonth: 1,
    endYear: null as number | null, endMonth: null as number | null, description: '',
  });

  const openNew = () => {
    setForm({
      company: '', role: '', location: '',
      startYear: new Date().getFullYear(), startMonth: 1,
      endYear: null, endMonth: null, description: '',
    });
    setEditing('new');
  };
  const openEdit = (id: string) => {
    const e = resume?.experiences.find((x) => x.id === id);
    if (!e) return;
    setForm({
      company: e.company, role: e.role, location: e.location ?? '',
      startYear: e.startYear, startMonth: e.startMonth,
      endYear: e.endYear ?? null, endMonth: e.endMonth ?? null,
      description: e.description ?? '',
    });
    setEditing(id);
  };
  const save = async () => {
    if (!form.company.trim() || !form.role.trim()) return toast.error('Company & role required');
    const payload = {
      company: form.company.trim(), role: form.role.trim(),
      location: form.location.trim() || null,
      startYear: form.startYear, startMonth: form.startMonth,
      endYear: form.endYear, endMonth: form.endMonth,
      description: form.description.trim() || null,
    };
    try {
      if (editing === 'new') await add.mutateAsync(payload);
      else if (editing) await upd.mutateAsync({ id: editing, ...payload });
      setEditing(null);
      toast.success('Saved');
    } catch (err) { toast.error((err as { message?: string }).message ?? 'Save failed'); }
  };

  return (
    <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5" /> Experience
        </h2>
        <Button size="sm" variant="outline" onClick={openNew}><Plus className="h-3 w-3" /> Add</Button>
      </div>
      <div className="mt-3 space-y-2">
        {(resume?.experiences ?? []).map((e) => (
          <div key={e.id} className="rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{e.role}</div>
                <div className="text-xs text-muted-foreground">{e.company}{e.location ? ` · ${e.location}` : ''}</div>
                <div className="text-[10px] text-muted-foreground">
                  {e.startMonth}/{e.startYear} – {e.endYear ? `${e.endMonth}/${e.endYear}` : 'Present'}
                </div>
                {e.description && <p className="mt-1 whitespace-pre-wrap text-xs">{e.description}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(e.id)} aria-label="Edit" className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground active:bg-muted">
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => { if (window.confirm('Remove this experience?')) del.mutate(e.id); }} aria-label="Delete" className="grid h-7 w-7 place-items-center rounded-full text-red-500 active:bg-red-500/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {(resume?.experiences ?? []).length === 0 && !editing && (
          <p className="text-center text-xs text-muted-foreground">No experience added yet.</p>
        )}
      </div>

      {editing && (
        <div className="mt-4 space-y-3 rounded-xl border-2 border-primary/30 bg-primary/5 p-3">
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Role *" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input" />
            <input placeholder="Company *" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="input" />
          </div>
          <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input" />
          <div className="grid grid-cols-4 gap-2">
            <input type="number" placeholder="From mo" value={form.startMonth} onChange={(e) => setForm({ ...form, startMonth: Number(e.target.value) })} className="input" />
            <input type="number" placeholder="From yr" value={form.startYear} onChange={(e) => setForm({ ...form, startYear: Number(e.target.value) })} className="input" />
            <input type="number" placeholder="To mo" value={form.endMonth ?? ''} onChange={(e) => setForm({ ...form, endMonth: e.target.value ? Number(e.target.value) : null })} className="input" />
            <input type="number" placeholder="To yr" value={form.endYear ?? ''} onChange={(e) => setForm({ ...form, endYear: e.target.value ? Number(e.target.value) : null })} className="input" />
          </div>
          <textarea rows={4} placeholder="Achievements & responsibilities" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" />
          <div className="flex gap-2">
            <Button variant="outline" size="default" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="brand" size="default" className="flex-1" onClick={save}>Save</Button>
          </div>
        </div>
      )}
      <style jsx>{`
        .input { width: 100%; border-radius: 10px; border: 1px solid hsl(var(--border)); background-color: hsl(var(--background)); padding: 8px 10px; font-size: 13px; outline: none; }
        .input:focus { border-color: hsl(var(--primary)); }
        textarea.input { resize: vertical; }
      `}</style>
    </section>
  );
}

// -----------------------------------------------------------------------------
// EDUCATION
// -----------------------------------------------------------------------------
function EducationSection({ resume }: { resume: Resume | undefined }) {
  const add = useAddEducation();
  const upd = useUpdateEducation();
  const del = useDeleteEducation();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState({ school: '', degree: '', fieldOfStudy: '', startYear: new Date().getFullYear() - 4, endYear: null as number | null, description: '' });

  const save = async () => {
    if (!form.school.trim()) return toast.error('School required');
    const payload = {
      school: form.school.trim(),
      degree: form.degree.trim() || null,
      fieldOfStudy: form.fieldOfStudy.trim() || null,
      startYear: form.startYear, endYear: form.endYear,
      description: form.description.trim() || null,
    };
    try {
      if (editing === 'new') await add.mutateAsync(payload);
      else if (editing) await upd.mutateAsync({ id: editing, ...payload });
      setEditing(null);
      toast.success('Saved');
    } catch (err) { toast.error((err as { message?: string }).message ?? 'Save failed'); }
  };

  return (
    <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
          <GraduationCap className="h-3.5 w-3.5" /> Education
        </h2>
        <Button size="sm" variant="outline" onClick={() => { setForm({ school: '', degree: '', fieldOfStudy: '', startYear: new Date().getFullYear() - 4, endYear: null, description: '' }); setEditing('new'); }}><Plus className="h-3 w-3" /> Add</Button>
      </div>
      <div className="mt-3 space-y-2">
        {(resume?.education ?? []).map((e) => (
          <div key={e.id} className="rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{e.school}</div>
                <div className="text-xs text-muted-foreground">{e.degree}{e.fieldOfStudy ? ` · ${e.fieldOfStudy}` : ''}</div>
                <div className="text-[10px] text-muted-foreground">{e.startYear} – {e.endYear ?? 'Present'}</div>
              </div>
              <button onClick={() => { if (window.confirm('Remove?')) del.mutate(e.id); }} aria-label="Delete" className="grid h-7 w-7 place-items-center rounded-full text-red-500 active:bg-red-500/10">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <div className="mt-4 space-y-2 rounded-xl border-2 border-primary/30 bg-primary/5 p-3">
          <input placeholder="School *" value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} className="input" />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Degree" value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} className="input" />
            <input placeholder="Field of study" value={form.fieldOfStudy} onChange={(e) => setForm({ ...form, fieldOfStudy: e.target.value })} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="From yr" value={form.startYear} onChange={(e) => setForm({ ...form, startYear: Number(e.target.value) })} className="input" />
            <input type="number" placeholder="To yr" value={form.endYear ?? ''} onChange={(e) => setForm({ ...form, endYear: e.target.value ? Number(e.target.value) : null })} className="input" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="default" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="brand" size="default" className="flex-1" onClick={save}>Save</Button>
          </div>
        </div>
      )}
      <style jsx>{`
        .input { width: 100%; border-radius: 10px; border: 1px solid hsl(var(--border)); background-color: hsl(var(--background)); padding: 8px 10px; font-size: 13px; outline: none; }
        .input:focus { border-color: hsl(var(--primary)); }
      `}</style>
    </section>
  );
}

// -----------------------------------------------------------------------------
// CERTIFICATIONS
// -----------------------------------------------------------------------------
function CertificationSection({ resume }: { resume: Resume | undefined }) {
  const add = useAddCertification();
  const del = useDeleteCertification();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', issuer: '', issueYear: new Date().getFullYear(), issueMonth: null as number | null, credentialUrl: '' });
  const save = async () => {
    if (!form.name.trim() || !form.issuer.trim()) return toast.error('Name & issuer required');
    try {
      await add.mutateAsync({
        name: form.name.trim(), issuer: form.issuer.trim(),
        issueYear: form.issueYear, issueMonth: form.issueMonth,
        credentialUrl: form.credentialUrl.trim() || null,
      });
      setAdding(false);
      setForm({ name: '', issuer: '', issueYear: new Date().getFullYear(), issueMonth: null, credentialUrl: '' });
      toast.success('Saved');
    } catch (err) { toast.error((err as { message?: string }).message ?? 'Save failed'); }
  };
  return (
    <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
          <Award className="h-3.5 w-3.5" /> Certifications
        </h2>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="h-3 w-3" /> Add</Button>
      </div>
      <div className="mt-3 space-y-2">
        {(resume?.certifications ?? []).map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <div className="text-sm font-bold">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.issuer} · {c.issueYear}</div>
            </div>
            <button onClick={() => { if (window.confirm('Remove?')) del.mutate(c.id); }} aria-label="Delete" className="grid h-7 w-7 place-items-center rounded-full text-red-500 active:bg-red-500/10">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      {adding && (
        <div className="mt-4 space-y-2 rounded-xl border-2 border-primary/30 bg-primary/5 p-3">
          <input placeholder="Certification name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
          <input placeholder="Issuer *" value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} className="input" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Year" value={form.issueYear} onChange={(e) => setForm({ ...form, issueYear: Number(e.target.value) })} className="input" />
            <input placeholder="Credential URL (optional)" value={form.credentialUrl} onChange={(e) => setForm({ ...form, credentialUrl: e.target.value })} className="input" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="default" className="flex-1" onClick={() => setAdding(false)}>Cancel</Button>
            <Button variant="brand" size="default" className="flex-1" onClick={save}>Save</Button>
          </div>
        </div>
      )}
      <style jsx>{`
        .input { width: 100%; border-radius: 10px; border: 1px solid hsl(var(--border)); background-color: hsl(var(--background)); padding: 8px 10px; font-size: 13px; outline: none; }
        .input:focus { border-color: hsl(var(--primary)); }
      `}</style>
    </section>
  );
}
