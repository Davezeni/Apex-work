'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  Plus,
  Share2,
  Trash2,
  Edit2,
  Save,
  Sparkles,
  Eye,
  Briefcase,
  GraduationCap,
  Award,
  Cpu,
  Target,
  Palette,
  ShieldCheck,
  BarChart3,
  WandSparkles,
  X,
  FileInput,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import {
  useMyResume,
  useUpdateResume,
  useAddExperience,
  useUpdateExperience,
  useDeleteExperience,
  useAddEducation,
  useUpdateEducation,
  useDeleteEducation,
  useAddCertification,
  useDeleteCertification,
  type Resume,
} from '@/hooks/use-resume';
import { useAIResumeEnhance, useAIResumeReview, useAIResumeTailor } from '@/hooks/use-ai';
import { useResumeTemplates } from '@/hooks/use-resume-templates';
import { ResumeStudioSections } from '@/components/resume/studio-sections';
import { ResumeVersionsPanel } from '@/components/resume/versions-panel';
import { useI18n } from '@/i18n';
import type { ResumeContent, ResumeTemplateId } from '@apex-work/shared';
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
const EMPTY_RESUME_CONTENT: ResumeContent = {
  skills: [],
  projects: [],
  achievements: [],
  volunteer: [],
  publications: [],
  references: [],
};

export default function ResumeBuilderPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: me, isLoading: meLoading, isAuthed } = useMe();
  const { data: resume, isLoading } = useMyResume();
  const update = useUpdateResume();
  const enhance = useAIResumeEnhance();
  const review = useAIResumeReview();
  const tailor = useAIResumeTailor();
  const templateCatalog = useResumeTemplates();

  useEffect(() => {
    if (!meLoading && !isAuthed) router.replace('/login?next=/resume');
  }, [meLoading, isAuthed, router]);

  const [basics, setBasics] = useState({
    headline: '',
    summary: '',
    phone: '',
    email: '',
    city: '',
    website: '',
    linkedin: '',
    github: '',
    targetRole: '',
    accentColor: '#7c3aed',
    templateId: 'classic' as ResumeTemplateId,
    isPublic: true,
    languages: [] as string[],
  });
  const [content, setContent] = useState<ResumeContent>(EMPTY_RESUME_CONTENT);
  const [langInput, setLangInput] = useState('');
  const [tailorOpen, setTailorOpen] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [aiTarget, setAiTarget] = useState<null | {
    section: 'summary' | 'experience' | 'education';
    onApply: (s: string) => void;
  }>(null);

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
      targetRole: resume.targetRole ?? '',
      accentColor: resume.accentColor ?? '#7c3aed',
      templateId: (resume.templateId || resume.theme || 'classic') as ResumeTemplateId,
      isPublic: resume.isPublic ?? true,
      languages: resume.languages ?? [],
    });
    setContent(resume.content ?? EMPTY_RESUME_CONTENT);
  }, [resume]);

  if (isLoading || !me || !resume) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
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
        targetRole: basics.targetRole || null,
        accentColor: basics.accentColor || null,
        templateId: basics.templateId,
        isPublic: basics.isPublic,
        content,
        languages: basics.languages,
        theme: basics.templateId,
      });
      toast.success(dt('Resume saved ✅'));
    } catch (err) {
      toast.error((err as { message?: string }).message ?? 'Save failed');
    }
  };

  const runReview = () => {
    review.mutate(
      {
        targetRole: basics.targetRole || undefined,
        headline: basics.headline || undefined,
        summary: basics.summary || undefined,
        skills: content.skills.map((skill) => skill.name),
        experience: resume.experiences.map((item) => ({
          role: item.role,
          company: item.company,
          description: item.description ?? undefined,
        })),
        projects: content.projects.map((project) => ({
          title: project.title,
          description: project.description ?? undefined,
        })),
      },
      {
        onSuccess: () => toast.success(dt('Your Resume Coach report is ready')),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const runTailor = () => {
    if (jobDescription.trim().length < 30)
      return toast.error(dt('Paste a job description of at least 30 characters'));
    tailor.mutate(
      {
        jobDescription,
        targetRole: basics.targetRole || undefined,
        resume: {
          headline: basics.headline || undefined,
          summary: basics.summary || undefined,
          skills: content.skills.map((skill) => skill.name),
          experience: resume.experiences.map((item) => ({
            role: item.role,
            company: item.company,
            description: item.description ?? undefined,
          })),
          projects: content.projects.map((item) => ({
            title: item.title,
            description: item.description ?? undefined,
          })),
        },
      },
      {
        onSuccess: () => toast.success(dt('Role-tailored recommendations are ready')),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const applyTailoredSummary = () => {
    if (!tailor.data) return;
    setBasics((current) => ({
      ...current,
      headline: tailor.data.tailoredHeadline || current.headline,
      summary: tailor.data.tailoredSummary || current.summary,
    }));
    toast.success(dt('Tailored headline and summary applied — save your resume'));
    setTailorOpen(false);
  };

  const runAI = async () => {
    if (!aiTarget) return;
    try {
      const src = aiTarget.section === 'summary' ? basics.summary : '';
      if (!src.trim()) return toast.error(dt('Add some text first'));
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
        <button
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-extrabold tracking-tight">{dt('Resume / CV')}</h1>
          <div className="text-[10px] text-muted-foreground">Build once — export or share</div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/resume/import">
              <FileInput className="h-4 w-4" /> Import
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/u/${me.username}/resume`}>
              <Share2 className="h-4 w-4" /> Share
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/resume/preview">
              <Eye className="h-4 w-4" /> Preview
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl pb-10">
        <section className="mx-3 mt-4 overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                <Sparkles className="h-3 w-3" /> Apex Resume Studio
              </span>
              <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
                Your career, beautifully packaged.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Build one source of truth, tailor it for every role, and export a professional PDF
                in seconds.
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/resume/templates">
                  <Palette className="h-4 w-4" /> Templates
                </Link>
              </Button>
              <Button asChild variant="brand" size="sm">
                <Link href="/resume/preview">
                  <Eye className="h-4 w-4" /> Preview
                </Link>
              </Button>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <div className="flex items-center justify-between text-xs font-bold">
                <span>{dt('Profile completeness')}</span>
                <span className="text-primary">
                  {Math.round(
                    ([
                      basics.headline,
                      basics.summary,
                      basics.targetRole,
                      content.skills.length > 0,
                      content.projects.length > 0,
                      resume.experiences.length > 0,
                      resume.education.length > 0,
                      resume.certifications.length > 0,
                    ].filter(Boolean).length /
                      8) *
                      100,
                  )}
                  %
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.round(([basics.headline, basics.summary, basics.targetRole, content.skills.length > 0, content.projects.length > 0, resume.experiences.length > 0, resume.education.length > 0, resume.certifications.length > 0].filter(Boolean).length / 8) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                A complete profile gives AI better context and makes recruiter scanning easier.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-12 justify-start"
                onClick={runReview}
                disabled={review.isPending}
              >
                <BarChart3 className="h-4 w-4 text-primary" />
                {review.isPending ? 'Reviewing…' : 'Run AI Resume Coach'}
              </Button>
              <Button
                type="button"
                variant="brand"
                className="h-auto min-h-12 justify-start"
                onClick={() => {
                  tailor.reset();
                  setTailorOpen(true);
                }}
              >
                <WandSparkles className="h-4 w-4" /> Tailor to a job
              </Button>
            </div>
          </div>
          {review.data && <CoachReport report={review.data} />}
        </section>

        <ResumeVersionsPanel targetRole={basics.targetRole} />

        {/* Basics */}
        <Section title={dt('Basics')}>
          <Field label={dt('Headline')}>
            <input
              value={basics.headline}
              onChange={(e) => setBasics((s) => ({ ...s, headline: e.target.value }))}
              placeholder={dt('Senior Full-stack Developer · 5+ yrs')}
              className="input"
              maxLength={120}
            />
          </Field>
          <Field
            label={dt('Target role')}
            hint="The role you want next. Apex Coach uses it for ATS keywords and recommendations."
          >
            <div className="relative">
              <Target className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={basics.targetRole}
                onChange={(e) => setBasics((s) => ({ ...s, targetRole: e.target.value }))}
                placeholder={dt('e.g. Product Designer, Full-stack Developer')}
                className="input pl-9"
                maxLength={120}
              />
            </div>
          </Field>
          <Field label={dt('Summary')} hint="1-2 short paragraphs. AI can polish this.">
            <textarea
              value={basics.summary}
              onChange={(e) => setBasics((s) => ({ ...s, summary: e.target.value }))}
              rows={5}
              maxLength={2000}
              className="input"
            />
            <button
              type="button"
              onClick={() =>
                setAiTarget({
                  section: 'summary',
                  onApply: (v) => setBasics((s) => ({ ...s, summary: v })),
                })
              }
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-primary"
            >
              <Sparkles className="h-3 w-3" /> Enhance with AI
            </button>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={dt('Phone')}>
              <input
                value={basics.phone}
                onChange={(e) => setBasics((s) => ({ ...s, phone: e.target.value }))}
                className="input"
              />
            </Field>
            <Field label={dt('Email')}>
              <input
                value={basics.email}
                onChange={(e) => setBasics((s) => ({ ...s, email: e.target.value }))}
                type="email"
                className="input"
              />
            </Field>
            <Field label={dt('City')}>
              <input
                value={basics.city}
                onChange={(e) => setBasics((s) => ({ ...s, city: e.target.value }))}
                className="input"
              />
            </Field>
            <Field label={dt('Website')}>
              <input
                value={basics.website}
                onChange={(e) => setBasics((s) => ({ ...s, website: e.target.value }))}
                className="input"
              />
            </Field>
            <Field label={dt('LinkedIn URL')}>
              <input
                value={basics.linkedin}
                onChange={(e) => setBasics((s) => ({ ...s, linkedin: e.target.value }))}
                className="input"
              />
            </Field>
            <Field label={dt('GitHub URL')}>
              <input
                value={basics.github}
                onChange={(e) => setBasics((s) => ({ ...s, github: e.target.value }))}
                className="input"
              />
            </Field>
          </div>

          <Field label={dt('Languages')}>
            <div className="flex gap-2">
              <input
                value={langInput}
                onChange={(e) => setLangInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && langInput.trim()) {
                    e.preventDefault();
                    if (
                      basics.languages.length < 15 &&
                      !basics.languages.includes(langInput.trim())
                    ) {
                      setBasics((s) => ({ ...s, languages: [...s.languages, langInput.trim()] }));
                    }
                    setLangInput('');
                  }
                }}
                placeholder={dt('English (Fluent)')}
                className="input flex-1"
              />
              <Button
                variant="outline"
                size="default"
                onClick={() => {
                  if (langInput.trim() && basics.languages.length < 15) {
                    setBasics((s) => ({ ...s, languages: [...s.languages, langInput.trim()] }));
                    setLangInput('');
                  }
                }}
              >
                Add
              </Button>
            </div>
            {basics.languages.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {basics.languages.map((l) => (
                  <span
                    key={l}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs"
                  >
                    {l}
                    <button
                      onClick={() =>
                        setBasics((s) => ({ ...s, languages: s.languages.filter((x) => x !== l) }))
                      }
                      aria-label={dt('Remove')}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Field>

          <Field label={dt('Design & sharing')}>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-3">
              <Palette className="h-4 w-4 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">
                  {templateCatalog.data?.templates.find((item) => item.id === basics.templateId)
                    ?.name ?? basics.templateId}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Change layouts, unlock Pro designs and choose your export format.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/resume/templates">{dt('Browse')}</Link>
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold">
                <span>{dt('Accent')}</span>
                <input
                  type="color"
                  value={basics.accentColor}
                  onChange={(e) => setBasics((s) => ({ ...s, accentColor: e.target.value }))}
                  className="h-8 w-10 cursor-pointer rounded border border-border bg-background p-1"
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={basics.isPublic}
                  onChange={(e) => setBasics((s) => ({ ...s, isPublic: e.target.checked }))}
                />{' '}
                Public share link
              </label>
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" /> You can hide your CV anytime
              </span>
            </div>
          </Field>

          <Button
            variant="brand"
            size="lg"
            className="w-full"
            onClick={saveBasics}
            disabled={update.isPending}
          >
            {update.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4" /> Save resume
              </>
            )}
          </Button>
        </Section>

        <ResumeStudioSections
          content={content}
          onChange={setContent}
          targetRole={basics.targetRole}
          summary={basics.summary}
        />

        <div className="mx-3 mt-4">
          <Button
            variant="brand"
            size="lg"
            className="w-full"
            onClick={saveBasics}
            disabled={update.isPending}
          >
            {update.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4" /> Save all resume changes
              </>
            )}
          </Button>
        </div>

        {/* Experience */}
        <ExperienceSection resume={resume} />
        {/* Education */}
        <EducationSection resume={resume} />
        {/* Certifications */}
        <CertificationSection resume={resume} />

        {/* AI confirm dialog */}
        {aiTarget && (
          <div
            className="fixed inset-0 z-[100] grid place-items-end bg-black/60 backdrop-blur-sm sm:place-items-center"
            onClick={() => setAiTarget(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl border border-b-0 border-border bg-card p-6 sm:rounded-3xl"
            >
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted sm:hidden" />
              <div className="flex items-center gap-2 text-sm font-bold">
                <Cpu className="h-4 w-4 text-primary" /> Enhance with AI
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                We&rsquo;ll send your current text to our AI editor and replace it with a polished
                version. Nothing is saved until you tap &ldquo;Save basics&rdquo;.
              </p>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => setAiTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="brand"
                  size="lg"
                  className="flex-1"
                  onClick={runAI}
                  disabled={enhance.isPending}
                >
                  {enhance.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Enhance
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tailor this resume to one job without changing the saved CV until the user approves. */}
        {tailorOpen && (
          <div
            className="fixed inset-0 z-[100] grid place-items-end bg-black/60 backdrop-blur-sm sm:place-items-center"
            onClick={() => setTailorOpen(false)}
          >
            <div
              className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-b-0 border-border bg-card p-5 sm:rounded-3xl sm:border-b sm:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted sm:hidden" />
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <WandSparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-extrabold">{dt('Tailor your CV to a job')}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Paste the job description. Apex will reorder your strengths and rewrite your
                    headline and summary using only facts already in your resume.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTailorOpen(false)}
                  aria-label={dt('Close')}
                  className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                rows={7}
                maxLength={6000}
                placeholder={dt('Paste the job description here…')}
                className="input mt-4 min-h-[150px]"
              />
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setTailorOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="brand"
                  className="flex-1"
                  onClick={runTailor}
                  disabled={tailor.isPending}
                >
                  {tailor.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <WandSparkles className="h-4 w-4" />
                  )}{' '}
                  {tailor.isPending ? 'Tailoring…' : 'Tailor with AI'}
                </Button>
              </div>
              {tailor.data && (
                <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-14 w-14 place-items-center rounded-full border-4 border-primary/20 bg-background text-lg font-black text-primary">
                      {tailor.data.matchScore}
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold">{dt('Role match estimate')}</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {tailor.data.source === 'ai'
                          ? 'AI-tailored from your current facts'
                          : 'Starter estimate — AI provider unavailable'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-background p-3">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Suggested headline
                      </div>
                      <p className="mt-1 text-sm font-semibold">
                        {tailor.data.tailoredHeadline || 'Keep your current headline'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-background p-3">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Suggested summary
                      </div>
                      <p className="mt-1 line-clamp-5 whitespace-pre-wrap text-xs">
                        {tailor.data.tailoredSummary || 'Add a summary before tailoring.'}
                      </p>
                    </div>
                  </div>
                  {tailor.data.keywordGaps.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-bold">{dt('Keyword gaps to review')}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {tailor.data.keywordGaps.map((item) => (
                          <span
                            key={item}
                            className="rounded-full bg-background px-2 py-1 text-[10px] font-semibold"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {tailor.data.experienceBullets.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-bold">{dt('Suggested bullet rewrites')}</div>
                      <div className="mt-2 space-y-2">
                        {tailor.data.experienceBullets.map((item) => (
                          <div
                            key={`${item.company}-${item.role}`}
                            className="rounded-xl bg-background p-3"
                          >
                            <div className="text-xs font-semibold">
                              {item.role}
                              {item.company ? ` · ${item.company}` : ''}
                            </div>
                            <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                              {item.bullets.map((bullet) => (
                                <li key={bullet}>{bullet}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-4 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setTailorOpen(false)}
                    >
                      Keep reviewing
                    </Button>
                    <Button
                      type="button"
                      variant="brand"
                      className="flex-1"
                      onClick={applyTailoredSummary}
                    >
                      <Save className="h-4 w-4" /> Apply headline & summary
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
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
        textarea.input {
          resize: vertical;
        }
      `}</style>
    </div>
  );
}

function CoachReport({
  report,
}: {
  report: {
    score: number;
    strengths: string[];
    improvements: string[];
    missingSections: string[];
    keywords: string[];
    source: 'ai' | 'fallback';
  };
}) {
  return (
    <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-full border-4 border-primary/20 bg-background text-lg font-black text-primary">
          {report.score}
        </div>
        <div>
          <div className="flex items-center gap-2 text-sm font-extrabold">
            <BarChart3 className="h-4 w-4" /> AI Resume Coach
          </div>
          <p className="text-[11px] text-muted-foreground">
            {report.source === 'ai'
              ? 'Personalized review'
              : 'Starter review — AI provider unavailable'}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-bold text-emerald-600">{dt('What is working')}</h3>
          <ul className="mt-2 space-y-1 text-xs">
            {report.strengths.slice(0, 4).map((item) => (
              <li key={item}>✓ {item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-bold text-amber-600">{dt('Next improvements')}</h3>
          <ul className="mt-2 space-y-1 text-xs">
            {report.improvements.slice(0, 5).map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      </div>
      {report.keywords.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="text-[11px] font-bold">Suggested keywords:</span>
          {report.keywords.map((item) => (
            <span
              key={item}
              className="rounded-full bg-background px-2 py-1 text-[10px] font-semibold"
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mx-3 mt-4 space-y-3 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-extrabold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
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
    company: '',
    role: '',
    location: '',
    startYear: new Date().getFullYear(),
    startMonth: 1,
    endYear: null as number | null,
    endMonth: null as number | null,
    description: '',
  });

  const openNew = () => {
    setForm({
      company: '',
      role: '',
      location: '',
      startYear: new Date().getFullYear(),
      startMonth: 1,
      endYear: null,
      endMonth: null,
      description: '',
    });
    setEditing('new');
  };
  const openEdit = (id: string) => {
    const e = resume?.experiences.find((x) => x.id === id);
    if (!e) return;
    setForm({
      company: e.company,
      role: e.role,
      location: e.location ?? '',
      startYear: e.startYear,
      startMonth: e.startMonth,
      endYear: e.endYear ?? null,
      endMonth: e.endMonth ?? null,
      description: e.description ?? '',
    });
    setEditing(id);
  };
  const save = async () => {
    if (!form.company.trim() || !form.role.trim())
      return toast.error(dt('Company & role required'));
    const payload = {
      company: form.company.trim(),
      role: form.role.trim(),
      location: form.location.trim() || null,
      startYear: form.startYear,
      startMonth: form.startMonth,
      endYear: form.endYear,
      endMonth: form.endMonth,
      description: form.description.trim() || null,
    };
    try {
      if (editing === 'new') await add.mutateAsync(payload);
      else if (editing) await upd.mutateAsync({ id: editing, ...payload });
      setEditing(null);
      toast.success(dt('Saved'));
    } catch (err) {
      toast.error((err as { message?: string }).message ?? 'Save failed');
    }
  };

  return (
    <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-widest text-muted-foreground">
          <Briefcase className="h-3.5 w-3.5" /> Experience
        </h2>
        <Button size="sm" variant="outline" onClick={openNew}>
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        {(resume?.experiences ?? []).map((e) => (
          <div key={e.id} className="rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{e.role}</div>
                <div className="text-xs text-muted-foreground">
                  {e.company}
                  {e.location ? ` · ${e.location}` : ''}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {e.startMonth}/{e.startYear} –{' '}
                  {e.endYear ? `${e.endMonth}/${e.endYear}` : 'Present'}
                </div>
                {e.description && (
                  <p className="mt-1 whitespace-pre-wrap text-xs">{e.description}</p>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openEdit(e.id)}
                  aria-label={dt('Edit')}
                  className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground active:bg-muted"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Remove this experience?')) del.mutate(e.id);
                  }}
                  aria-label={dt('Delete')}
                  className="grid h-7 w-7 place-items-center rounded-full text-red-500 active:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {(resume?.experiences ?? []).length === 0 && !editing && (
          <p className="text-center text-xs text-muted-foreground">
            {dt('No experience added yet.')}
          </p>
        )}
      </div>

      {editing && (
        <div className="mt-4 space-y-3 rounded-xl border-2 border-primary/30 bg-primary/5 p-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder={dt('Role *')}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="input"
            />
            <input
              placeholder={dt('Company *')}
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="input"
            />
          </div>
          <input
            placeholder={dt('Location')}
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="input"
          />
          <div className="grid grid-cols-4 gap-2">
            <input
              type="number"
              placeholder={dt('From mo')}
              value={form.startMonth}
              onChange={(e) => setForm({ ...form, startMonth: Number(e.target.value) })}
              className="input"
            />
            <input
              type="number"
              placeholder={dt('From yr')}
              value={form.startYear}
              onChange={(e) => setForm({ ...form, startYear: Number(e.target.value) })}
              className="input"
            />
            <input
              type="number"
              placeholder={dt('To mo')}
              value={form.endMonth ?? ''}
              onChange={(e) =>
                setForm({ ...form, endMonth: e.target.value ? Number(e.target.value) : null })
              }
              className="input"
            />
            <input
              type="number"
              placeholder={dt('To yr')}
              value={form.endYear ?? ''}
              onChange={(e) =>
                setForm({ ...form, endYear: e.target.value ? Number(e.target.value) : null })
              }
              className="input"
            />
          </div>
          <textarea
            rows={4}
            placeholder={dt('Achievements & responsibilities')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="default"
              className="flex-1"
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
            <Button variant="brand" size="default" className="flex-1" onClick={save}>
              Save
            </Button>
          </div>
        </div>
      )}
      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 10px;
          border: 1px solid hsl(var(--border));
          background-color: hsl(var(--background));
          padding: 8px 10px;
          font-size: 13px;
          outline: none;
        }
        .input:focus {
          border-color: hsl(var(--primary));
        }
        textarea.input {
          resize: vertical;
        }
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
  const [form, setForm] = useState({
    school: '',
    degree: '',
    fieldOfStudy: '',
    startYear: new Date().getFullYear() - 4,
    endYear: null as number | null,
    description: '',
  });

  const save = async () => {
    if (!form.school.trim()) return toast.error(dt('School required'));
    const payload = {
      school: form.school.trim(),
      degree: form.degree.trim() || null,
      fieldOfStudy: form.fieldOfStudy.trim() || null,
      startYear: form.startYear,
      endYear: form.endYear,
      description: form.description.trim() || null,
    };
    try {
      if (editing === 'new') await add.mutateAsync(payload);
      else if (editing) await upd.mutateAsync({ id: editing, ...payload });
      setEditing(null);
      toast.success(dt('Saved'));
    } catch (err) {
      toast.error((err as { message?: string }).message ?? 'Save failed');
    }
  };

  return (
    <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-widest text-muted-foreground">
          <GraduationCap className="h-3.5 w-3.5" /> Education
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setForm({
              school: '',
              degree: '',
              fieldOfStudy: '',
              startYear: new Date().getFullYear() - 4,
              endYear: null,
              description: '',
            });
            setEditing('new');
          }}
        >
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        {(resume?.education ?? []).map((e) => (
          <div key={e.id} className="rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{e.school}</div>
                <div className="text-xs text-muted-foreground">
                  {e.degree}
                  {e.fieldOfStudy ? ` · ${e.fieldOfStudy}` : ''}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {e.startYear} – {e.endYear ?? 'Present'}
                </div>
              </div>
              <button
                onClick={() => {
                  if (window.confirm('Remove?')) del.mutate(e.id);
                }}
                aria-label={dt('Delete')}
                className="grid h-7 w-7 place-items-center rounded-full text-red-500 active:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <div className="mt-4 space-y-2 rounded-xl border-2 border-primary/30 bg-primary/5 p-3">
          <input
            placeholder={dt('School *')}
            value={form.school}
            onChange={(e) => setForm({ ...form, school: e.target.value })}
            className="input"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder={dt('Degree')}
              value={form.degree}
              onChange={(e) => setForm({ ...form, degree: e.target.value })}
              className="input"
            />
            <input
              placeholder={dt('Field of study')}
              value={form.fieldOfStudy}
              onChange={(e) => setForm({ ...form, fieldOfStudy: e.target.value })}
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder={dt('From yr')}
              value={form.startYear}
              onChange={(e) => setForm({ ...form, startYear: Number(e.target.value) })}
              className="input"
            />
            <input
              type="number"
              placeholder={dt('To yr')}
              value={form.endYear ?? ''}
              onChange={(e) =>
                setForm({ ...form, endYear: e.target.value ? Number(e.target.value) : null })
              }
              className="input"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="default"
              className="flex-1"
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
            <Button variant="brand" size="default" className="flex-1" onClick={save}>
              Save
            </Button>
          </div>
        </div>
      )}
      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 10px;
          border: 1px solid hsl(var(--border));
          background-color: hsl(var(--background));
          padding: 8px 10px;
          font-size: 13px;
          outline: none;
        }
        .input:focus {
          border-color: hsl(var(--primary));
        }
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
  const [form, setForm] = useState({
    name: '',
    issuer: '',
    issueYear: new Date().getFullYear(),
    issueMonth: null as number | null,
    credentialUrl: '',
  });
  const save = async () => {
    if (!form.name.trim() || !form.issuer.trim()) return toast.error(dt('Name & issuer required'));
    try {
      await add.mutateAsync({
        name: form.name.trim(),
        issuer: form.issuer.trim(),
        issueYear: form.issueYear,
        issueMonth: form.issueMonth,
        credentialUrl: form.credentialUrl.trim() || null,
      });
      setAdding(false);
      setForm({
        name: '',
        issuer: '',
        issueYear: new Date().getFullYear(),
        issueMonth: null,
        credentialUrl: '',
      });
      toast.success(dt('Saved'));
    } catch (err) {
      toast.error((err as { message?: string }).message ?? 'Save failed');
    }
  };
  return (
    <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-widest text-muted-foreground">
          <Award className="h-3.5 w-3.5" /> Certifications
        </h2>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        {(resume?.certifications ?? []).map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-xl border border-border p-3"
          >
            <div>
              <div className="text-sm font-bold">{c.name}</div>
              <div className="text-xs text-muted-foreground">
                {c.issuer} · {c.issueYear}
              </div>
            </div>
            <button
              onClick={() => {
                if (window.confirm('Remove?')) del.mutate(c.id);
              }}
              aria-label={dt('Delete')}
              className="grid h-7 w-7 place-items-center rounded-full text-red-500 active:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      {adding && (
        <div className="mt-4 space-y-2 rounded-xl border-2 border-primary/30 bg-primary/5 p-3">
          <input
            placeholder={dt('Certification name *')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
          />
          <input
            placeholder={dt('Issuer *')}
            value={form.issuer}
            onChange={(e) => setForm({ ...form, issuer: e.target.value })}
            className="input"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder={dt('Year')}
              value={form.issueYear}
              onChange={(e) => setForm({ ...form, issueYear: Number(e.target.value) })}
              className="input"
            />
            <input
              placeholder={dt('Credential URL (optional)')}
              value={form.credentialUrl}
              onChange={(e) => setForm({ ...form, credentialUrl: e.target.value })}
              className="input"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="default"
              className="flex-1"
              onClick={() => setAdding(false)}
            >
              Cancel
            </Button>
            <Button variant="brand" size="default" className="flex-1" onClick={save}>
              Save
            </Button>
          </div>
        </div>
      )}
      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 10px;
          border: 1px solid hsl(var(--border));
          background-color: hsl(var(--background));
          padding: 8px 10px;
          font-size: 13px;
          outline: none;
        }
        .input:focus {
          border-color: hsl(var(--primary));
        }
      `}</style>
    </section>
  );
}
