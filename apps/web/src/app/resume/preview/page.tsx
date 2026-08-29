'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  Eye,
  FileText,
  Loader2,
  Palette,
  Printer,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { downloadResumeDocx, downloadResumePdf } from '@/lib/resume-export';
import { useMe } from '@/hooks/use-me';
import { useMyResume, type Resume } from '@/hooks/use-resume';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import {
  RESUME_FORMATS,
  RESUME_TEMPLATES,
  type ResumeFormatId,
  type ResumeTemplateId,
} from '@apex-work/shared';

const FORMAT_IDS = new Set(RESUME_FORMATS.map((format) => format.id));
const TEMPLATE_IDS = new Set(RESUME_TEMPLATES.map((template) => template.id));

function safeFormat(value: string | null): ResumeFormatId {
  return value && FORMAT_IDS.has(value as ResumeFormatId) ? (value as ResumeFormatId) : 'a4';
}

function safeTemplate(value: string | null | undefined): ResumeTemplateId | string {
  return value && TEMPLATE_IDS.has(value as ResumeTemplateId)
    ? (value as ResumeTemplateId)
    : 'classic';
}

/**
 * Resume Studio preview. Every toolbar format prints through the browser's
 * Unicode-safe PDF pipeline, so Amharic text and international characters are
 * preserved. Users choose "Save as PDF" in the native print dialog.
 */
export default function ResumePreviewPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const { data: me } = useMe();
  const { data: resume, isLoading } = useMyResume();
  const [format, setFormat] = useState<ResumeFormatId>(() => safeFormat(params.get('format')));
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);

  useEffect(() => {
    setFormat(safeFormat(params.get('format')));
  }, [params]);

  useEffect(() => {
    document.title = `${me?.fullName ?? 'My'} · Resume`;
    return () => {
      document.title = 'Apex-Work';
    };
  }, [me]);

  const templateId = safeTemplate(resume?.templateId || resume?.theme);
  const template = useMemo(
    () => RESUME_TEMPLATES.find((item) => item.id === templateId),
    [templateId],
  );

  if (isLoading || !resume || !me) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handlePdfDownload = async () => {
    const element = document.getElementById('resume-document');
    if (!element) return toast.error('Resume preview is not ready yet');
    setExporting('pdf');
    try {
      await downloadResumePdf(element, me.fullName, format);
      toast.success('PDF downloaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'PDF export failed');
    } finally {
      setExporting(null);
    }
  };

  const handleDocxDownload = async () => {
    setExporting('docx');
    try {
      await downloadResumeDocx(resume, me.fullName, format);
      toast.success('Editable DOCX downloaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'DOCX export failed');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="min-h-dvh bg-muted/40 pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl print:hidden">
        <button
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-extrabold tracking-tight">Resume preview</h1>
          <p className="truncate text-[10px] text-muted-foreground">
            {template?.name ?? 'Apex template'} · {formatName(format)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/resume/templates">
              <Palette className="h-4 w-4" /> Templates
            </Link>
          </Button>
          <select
            value={format}
            onChange={(event) => setFormat(safeFormat(event.target.value))}
            aria-label="PDF format"
            className="hidden h-9 rounded-lg border border-border bg-background px-2 text-xs font-semibold sm:block"
          >
            {RESUME_FORMATS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            title="Print or save as PDF"
          >
            <Printer className="h-4 w-4" /> <span className="hidden sm:inline">Print</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDocxDownload}
            disabled={!!exporting}
            title="Download an editable Word document"
          >
            {exporting === 'docx' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}{' '}
            <span className="hidden sm:inline">DOCX</span>
          </Button>
          <Button
            size="sm"
            variant="brand"
            onClick={handlePdfDownload}
            disabled={!!exporting}
            title="Download a PDF file"
          >
            {exporting === 'pdf' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}{' '}
            PDF
          </Button>
        </div>
      </header>

      <div className="mx-3 mt-3 flex gap-2 overflow-x-auto sm:hidden print:hidden">
        {RESUME_FORMATS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFormat(item.id)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold',
              format === item.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground',
            )}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div
        id="resume-document"
        className={cn(
          'resume-paper mx-auto my-6 max-w-3xl bg-white text-black shadow-xl print:my-0 print:max-w-none print:shadow-none',
          `resume-paper-${format}`,
          'p-6 sm:p-10 print:p-8',
        )}
      >
        <ResumeTemplate templateId={templateId} resume={resume} name={me.fullName} />
        {format === 'portfolio' && <PortfolioAppendix resume={resume} />}
      </div>

      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 text-[11px] text-muted-foreground sm:px-0 print:hidden">
        <Eye className="h-3.5 w-3.5" /> PDF and DOCX downloads are generated in your browser; use
        Print only when you need the native print dialog.
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: ${format === 'letter' ? 'letter' : 'A4'};
            margin: ${format === 'one-page' ? '8mm' : '12mm'};
          }
          html,
          body {
            background: white !important;
          }
          .resume-paper-one-page {
            font-size: 0.86em !important;
          }
          .resume-paper-portfolio {
            font-size: 0.92em !important;
          }
          .resume-paper-portfolio .resume-project-card {
            break-inside: avoid;
          }
          .resume-paper-one-page section {
            margin-top: 0.7rem !important;
          }
        }
        @media screen {
          .resume-paper {
            min-height: 297mm;
          }
          .resume-paper-letter {
            min-height: 279mm;
          }
        }
      `}</style>
    </div>
  );
}

function formatName(format: ResumeFormatId) {
  return RESUME_FORMATS.find((item) => item.id === format)?.name ?? 'A4 Resume';
}

function ResumeTemplate({
  templateId,
  resume,
  name,
}: {
  templateId: ResumeTemplateId | string;
  resume: Resume;
  name: string;
}) {
  switch (templateId) {
    case 'modern':
      return <ModernTheme resume={resume} name={name} />;
    case 'minimal':
      return <MinimalTheme resume={resume} name={name} />;
    case 'ats-clean':
      return <AtsCleanTheme resume={resume} name={name} />;
    case 'executive':
      return <ExecutiveTheme resume={resume} name={name} />;
    case 'creative':
      return <CreativeTheme resume={resume} name={name} />;
    case 'tech-grid':
      return <TechGridTheme resume={resume} name={name} />;
    case 'academic':
      return <AcademicTheme resume={resume} name={name} />;
    default:
      return <ClassicTheme resume={resume} name={name} />;
  }
}

function periodLabel(
  sy: number,
  sm: number,
  ey: number | null | undefined,
  em: number | null | undefined,
) {
  const start = `${String(sm).padStart(2, '0')}/${sy}`;
  const end = ey ? `${String(em ?? 12).padStart(2, '0')}/${ey}` : 'Present';
  return `${start} – ${end}`;
}

function Header({ resume, name, dark = false }: { resume: Resume; name: string; dark?: boolean }) {
  const contact = [
    resume.email,
    resume.phone,
    resume.city,
    resume.website,
    resume.linkedin,
    resume.github,
  ].filter(Boolean);
  return (
    <header className={cn('border-b pb-3', dark ? 'border-white/30' : 'border-black')}>
      <h1 className="text-3xl font-extrabold tracking-tight">{name}</h1>
      {resume.headline && (
        <p
          className={cn(
            'mt-1 text-base font-semibold',
            dark ? 'text-white/80' : 'text-neutral-700',
          )}
        >
          {resume.headline}
        </p>
      )}
      {resume.targetRole && (
        <p
          className={cn(
            'mt-1 text-xs font-bold uppercase tracking-widest',
            dark ? 'text-white/60' : 'text-neutral-500',
          )}
        >
          Target role · {resume.targetRole}
        </p>
      )}
      {contact.length > 0 && (
        <div
          className={cn(
            'mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs',
            dark ? 'text-white/75' : 'text-neutral-600',
          )}
        >
          {contact.map((item, index) => (
            <span key={`${item}-${index}`}>{String(item).replace(/^https?:\/\//, '')}</span>
          ))}
        </div>
      )}
    </header>
  );
}

function ClassicTheme({ resume, name }: { resume: Resume; name: string }) {
  return (
    <div className="font-serif leading-relaxed">
      <Header resume={resume} name={name} />
      <CommonSections resume={resume} />
    </div>
  );
}

function AtsCleanTheme({ resume, name }: { resume: Resume; name: string }) {
  return (
    <div className="font-sans leading-relaxed">
      <Header resume={resume} name={name} />
      {resume.summary && (
        <section className="mt-4">
          <h2 className="text-sm font-bold uppercase tracking-wide">Professional Summary</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm">{resume.summary}</p>
        </section>
      )}
      {resume.experiences.length > 0 && (
        <section className="mt-4">
          <h2 className="border-b border-black pb-1 text-sm font-bold uppercase tracking-wide">
            Professional Experience
          </h2>
          {resume.experiences.map((item) => (
            <ExperienceItem key={item.id} item={item} compact />
          ))}
        </section>
      )}
      {resume.content.skills.length > 0 && (
        <section className="mt-4">
          <h2 className="border-b border-black pb-1 text-sm font-bold uppercase tracking-wide">
            Core Skills
          </h2>
          <p className="mt-1 text-sm">
            {resume.content.skills.map((skill) => skill.name).join(' · ')}
          </p>
        </section>
      )}
      {resume.education.length > 0 && (
        <section className="mt-4">
          <h2 className="border-b border-black pb-1 text-sm font-bold uppercase tracking-wide">
            Education
          </h2>
          {resume.education.map((item) => (
            <EducationItem key={item.id} item={item} />
          ))}
        </section>
      )}
      {resume.certifications.length > 0 && (
        <section className="mt-4">
          <h2 className="border-b border-black pb-1 text-sm font-bold uppercase tracking-wide">
            Certifications
          </h2>
          <p className="mt-1 text-sm">
            {resume.certifications.map((item) => `${item.name} — ${item.issuer}`).join(' · ')}
          </p>
        </section>
      )}
    </div>
  );
}

function ModernTheme({ resume, name }: { resume: Resume; name: string }) {
  const accent = resume.accentColor ?? '#111827';
  return (
    <div className="grid grid-cols-3 gap-6 font-sans leading-relaxed">
      <aside
        className="print:print-color-adjust-exact col-span-1 p-4 text-white"
        style={{ backgroundColor: accent }}
      >
        <h1 className="text-2xl font-extrabold">{name}</h1>
        {resume.headline && <p className="mt-1 text-xs opacity-80">{resume.headline}</p>}
        <ContactList resume={resume} />
        <SkillList resume={resume} dark />
        {resume.languages.length > 0 && (
          <div className="mt-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-70">
              Languages
            </h3>
            <ul className="mt-1 text-xs">
              {resume.languages.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </aside>
      <div className="col-span-2 space-y-4">
        {resume.summary && (
          <p className="whitespace-pre-wrap text-sm text-neutral-800">{resume.summary}</p>
        )}
        <ExperienceBlock resume={resume} />
        <ProjectBlock resume={resume} />
        <EducationBlock resume={resume} />
        <AchievementBlock resume={resume} />
      </div>
    </div>
  );
}

function MinimalTheme({ resume, name }: { resume: Resume; name: string }) {
  return (
    <div className="font-sans leading-relaxed">
      <Header resume={resume} name={name} />
      {resume.summary && <p className="mt-6 whitespace-pre-wrap text-sm">{resume.summary}</p>}
      <ExperienceBlock resume={resume} minimal />
      <ProjectBlock resume={resume} minimal />
      <EducationBlock resume={resume} minimal />
      <div className="mt-6 grid grid-cols-2 gap-6">
        <SkillList resume={resume} />
        <AchievementBlock resume={resume} />
      </div>
    </div>
  );
}

function ExecutiveTheme({ resume, name }: { resume: Resume; name: string }) {
  const accent = resume.accentColor ?? '#7c3aed';
  return (
    <div className="font-sans leading-relaxed">
      <div
        className="flex items-end justify-between gap-6 border-b-4 pb-4"
        style={{ borderColor: accent }}
      >
        <div>
          <h1 className="text-4xl font-black tracking-tight">{name}</h1>
          {resume.headline && (
            <p className="mt-1 text-sm font-semibold text-neutral-600">{resume.headline}</p>
          )}
          {resume.targetRole && (
            <p
              className="mt-1 text-xs font-bold uppercase tracking-widest"
              style={{ color: accent }}
            >
              {resume.targetRole}
            </p>
          )}
        </div>
        <ContactList resume={resume} compact />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-7">
        <div className="col-span-2">
          <SummaryHeading title="Profile" accent={accent} />
          {resume.summary && <p className="whitespace-pre-wrap text-sm">{resume.summary}</p>}
          <SummaryHeading title="Experience" accent={accent} />
          <ExperienceItems resume={resume} />
          <SummaryHeading title="Selected projects" accent={accent} />
          <ProjectList resume={resume} />
        </div>
        <aside className="col-span-1">
          <SummaryHeading title="Expertise" accent={accent} />
          <SkillList resume={resume} />
          <SummaryHeading title="Education" accent={accent} />
          <EducationList resume={resume} />
          <SummaryHeading title="Awards" accent={accent} />
          <AchievementList resume={resume} />
        </aside>
      </div>
    </div>
  );
}

function CreativeTheme({ resume, name }: { resume: Resume; name: string }) {
  const accent = resume.accentColor ?? '#ec4899';
  return (
    <div className="font-sans leading-relaxed">
      <div
        className="print:print-color-adjust-exact rounded-2xl p-6 text-white"
        style={{ background: `linear-gradient(135deg, ${accent}, #7c3aed)` }}
      >
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/70">Portfolio CV</p>
        <h1 className="mt-2 text-4xl font-black">{name}</h1>
        {resume.headline && <p className="mt-1 text-sm text-white/85">{resume.headline}</p>}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/80">
          {[resume.email, resume.city, resume.website].filter(Boolean).map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>
      {resume.summary && (
        <p className="mt-6 max-w-2xl whitespace-pre-wrap text-sm leading-7 text-neutral-700">
          {resume.summary}
        </p>
      )}
      <div className="mt-6 grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <h2 className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: accent }}>
            Featured work
          </h2>
          <ProjectList resume={resume} card accent={accent} />
          <h2
            className="mt-6 text-xs font-black uppercase tracking-[0.2em]"
            style={{ color: accent }}
          >
            Experience
          </h2>
          <ExperienceItems resume={resume} />
        </div>
        <aside className="col-span-1">
          <h2 className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: accent }}>
            Toolkit
          </h2>
          <SkillList resume={resume} pills accent={accent} />
          <AchievementList resume={resume} accent={accent} />
        </aside>
      </div>
    </div>
  );
}

function TechGridTheme({ resume, name }: { resume: Resume; name: string }) {
  const accent = resume.accentColor ?? '#0f766e';
  return (
    <div className="font-mono leading-relaxed">
      <div className="border-l-8 pl-5" style={{ borderColor: accent }}>
        <h1 className="text-3xl font-black">{name}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {resume.targetRole || resume.headline || 'Freelance professional'}
        </p>
        <ContactList resume={resume} compact />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-6">
        <div>
          <TechHeading title="// summary" accent={accent} />
          {resume.summary && <p className="whitespace-pre-wrap text-sm">{resume.summary}</p>}
          <TechHeading title="// experience" accent={accent} />
          {resume.experiences.map((item) => (
            <ExperienceItem key={item.id} item={item} compact />
          ))}
          <TechHeading title="// projects" accent={accent} />
          {resume.content.projects.map((item) => (
            <ProjectCard key={item.id ?? item.title} project={item} accent={accent} />
          ))}
        </div>
        <aside>
          <TechHeading title="// skills" accent={accent} />
          <SkillList resume={resume} grid accent={accent} />
          <TechHeading title="// education" accent={accent} />
          <EducationList resume={resume} />
          <TechHeading title="// achievements" accent={accent} />
          <AchievementList resume={resume} />
        </aside>
      </div>
    </div>
  );
}

function AcademicTheme({ resume, name }: { resume: Resume; name: string }) {
  return (
    <div className="font-serif leading-relaxed">
      <Header resume={resume} name={name} />
      {resume.summary && (
        <section className="mt-5">
          <h2 className="text-sm font-bold">Research profile</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm">{resume.summary}</p>
        </section>
      )}
      <section className="mt-5">
        <h2 className="border-b border-black pb-1 text-sm font-bold">Appointments & experience</h2>
        <ExperienceItems resume={resume} />
      </section>
      <section className="mt-5">
        <h2 className="border-b border-black pb-1 text-sm font-bold">Education</h2>
        <EducationList resume={resume} />
      </section>
      <section className="mt-5">
        <h2 className="border-b border-black pb-1 text-sm font-bold">
          Publications, talks & projects
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {[
            ...resume.content.publications,
            ...resume.content.projects.map(
              (item) => `${item.title}${item.description ? ` — ${item.description}` : ''}`,
            ),
          ].map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      </section>
      <AchievementBlock resume={resume} />
      <SkillList resume={resume} />
    </div>
  );
}

function CommonSections({ resume }: { resume: Resume }) {
  return (
    <>
      {resume.summary && (
        <Block title="Summary">
          <p className="whitespace-pre-wrap text-sm">{resume.summary}</p>
        </Block>
      )}
      <ExperienceBlock resume={resume} />
      <ProjectBlock resume={resume} />
      <EducationBlock resume={resume} />
      <CertificationBlock resume={resume} />
      <AchievementBlock resume={resume} />
      <SkillList resume={resume} />
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-neutral-500">{title}</h2>
      {children}
    </section>
  );
}

function ExperienceBlock({ resume, minimal = false }: { resume: Resume; minimal?: boolean }) {
  return resume.experiences.length > 0 ? (
    <section className={minimal ? 'mt-6' : 'mt-4'}>
      <h2
        className={cn(
          'mb-2 text-xs font-bold uppercase tracking-widest text-neutral-500',
          minimal && 'border-b border-neutral-300 pb-1',
        )}
      >
        Experience
      </h2>
      <ExperienceItems resume={resume} />
    </section>
  ) : null;
}
function ExperienceItems({ resume }: { resume: Resume }) {
  return (
    <div>
      {resume.experiences.map((item) => (
        <ExperienceItem key={item.id} item={item} />
      ))}
    </div>
  );
}
function ExperienceItem({
  item,
  compact = false,
}: {
  item: Resume['experiences'][number];
  compact?: boolean;
}) {
  return (
    <div className={cn('mb-3', compact && 'mb-2')}>
      <div className="flex justify-between gap-3 text-sm font-bold">
        <span>
          {item.role} · {item.company}
        </span>
        <span className="shrink-0 text-xs font-normal text-neutral-600">
          {periodLabel(item.startYear, item.startMonth, item.endYear, item.endMonth)}
        </span>
      </div>
      {item.location && <div className="text-xs italic text-neutral-600">{item.location}</div>}
      {item.description && <p className="mt-1 whitespace-pre-wrap text-sm">{item.description}</p>}
    </div>
  );
}
function EducationBlock({ resume, minimal = false }: { resume: Resume; minimal?: boolean }) {
  return resume.education.length > 0 ? (
    <section className={minimal ? 'mt-6' : 'mt-4'}>
      <h2
        className={cn(
          'mb-2 text-xs font-bold uppercase tracking-widest text-neutral-500',
          minimal && 'border-b border-neutral-300 pb-1',
        )}
      >
        Education
      </h2>
      <EducationList resume={resume} />
    </section>
  ) : null;
}
function EducationList({ resume }: { resume: Resume }) {
  return (
    <div>
      {resume.education.map((item) => (
        <EducationItem key={item.id} item={item} />
      ))}
    </div>
  );
}
function EducationItem({ item }: { item: Resume['education'][number] }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between gap-3 text-sm font-bold">
        <span>{item.school}</span>
        <span className="shrink-0 text-xs font-normal text-neutral-600">
          {item.startYear} – {item.endYear ?? 'Present'}
        </span>
      </div>
      <div className="text-xs">
        {item.degree}
        {item.fieldOfStudy ? ` · ${item.fieldOfStudy}` : ''}
      </div>
      {item.description && <p className="mt-1 text-xs text-neutral-600">{item.description}</p>}
    </div>
  );
}
function CertificationBlock({ resume }: { resume: Resume }) {
  return resume.certifications.length > 0 ? (
    <Block title="Certifications">
      <ul className="ml-4 list-disc text-sm">
        {resume.certifications.map((item) => (
          <li key={item.id}>
            {item.name} — {item.issuer} ({item.issueYear})
          </li>
        ))}
      </ul>
    </Block>
  ) : null;
}
function ContactList({ resume, compact = false }: { resume: Resume; compact?: boolean }) {
  const values = [
    resume.email,
    resume.phone,
    resume.city,
    resume.website,
    resume.linkedin,
    resume.github,
  ].filter(Boolean);
  return (
    <div className={cn('mt-3 space-y-1 text-[11px]', compact && 'max-w-48 text-right')}>
      {values.map((item, index) => (
        <div key={`${item}-${index}`}>{String(item).replace(/^https?:\/\//, '')}</div>
      ))}
    </div>
  );
}
function SkillList({
  resume,
  dark = false,
  pills = false,
  grid = false,
  accent,
}: {
  resume: Resume;
  dark?: boolean;
  pills?: boolean;
  grid?: boolean;
  accent?: string;
}) {
  if (resume.content.skills.length === 0) return null;
  return (
    <div className={cn('mt-4', dark && 'text-white', grid && 'grid grid-cols-2 gap-1')}>
      {!pills && !grid && (
        <h3
          className={cn(
            'mb-2 text-xs font-bold uppercase tracking-widest',
            dark ? 'opacity-70' : 'text-neutral-500',
          )}
        >
          Skills
        </h3>
      )}
      <div className={cn('flex flex-wrap gap-1.5', grid && 'contents')}>
        {resume.content.skills.map((skill) => (
          <span
            key={skill.name}
            className={cn(
              'text-xs',
              pills && 'rounded-full px-2 py-1 font-semibold',
              dark ? 'text-white/85' : 'text-neutral-700',
              grid && 'border border-neutral-200 px-2 py-1',
            )}
            style={pills && accent ? { backgroundColor: `${accent}22`, color: accent } : undefined}
          >
            {skill.name}
            {!pills && !grid && (
              <span className="ml-1 text-[10px] text-neutral-400">{'●'.repeat(skill.level)}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
function AchievementBlock({ resume }: { resume: Resume }) {
  return resume.content.achievements.length > 0 ? (
    <Block title="Achievements">
      <AchievementList resume={resume} />
    </Block>
  ) : null;
}
function AchievementList({ resume, accent }: { resume: Resume; accent?: string }) {
  return (
    <ul className="ml-4 list-disc space-y-1 text-sm">
      {resume.content.achievements.map((item, index) => (
        <li key={`${item}-${index}`} style={accent ? { color: accent } : undefined}>
          <span className={accent ? 'text-black' : undefined}>{item}</span>
        </li>
      ))}
    </ul>
  );
}
function ProjectBlock({ resume, minimal = false }: { resume: Resume; minimal?: boolean }) {
  return resume.content.projects.length > 0 ? (
    <section className={minimal ? 'mt-6' : 'mt-4'}>
      <h2
        className={cn(
          'mb-2 text-xs font-bold uppercase tracking-widest text-neutral-500',
          minimal && 'border-b border-neutral-300 pb-1',
        )}
      >
        Selected projects
      </h2>
      <ProjectList resume={resume} />
    </section>
  ) : null;
}
function ProjectList({
  resume,
  card = false,
  accent,
}: {
  resume: Resume;
  card?: boolean;
  accent?: string;
}) {
  return (
    <div className={cn('space-y-2', card && 'mt-3')}>
      {resume.content.projects.map((project) => (
        <ProjectCard
          key={project.id ?? project.title}
          project={project}
          card={card}
          accent={accent}
        />
      ))}
    </div>
  );
}
function ProjectCard({
  project,
  card = false,
  accent,
}: {
  project: Resume['content']['projects'][number];
  card?: boolean;
  accent?: string;
}) {
  return (
    <div
      className={cn(
        'resume-project-card',
        card ? 'rounded-xl border border-neutral-200 p-3' : 'mb-3',
      )}
      style={card && accent ? { borderLeft: `3px solid ${accent}` } : undefined}
    >
      <div className="flex justify-between gap-3 text-sm font-bold">
        <span>{project.title}</span>
        {project.role && (
          <span className="text-xs font-normal text-neutral-600">{project.role}</span>
        )}
      </div>
      {project.description && (
        <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{project.description}</p>
      )}
      {project.highlights.length > 0 && (
        <ul className="ml-4 mt-1 list-disc text-xs text-neutral-600">
          {project.highlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {project.technologies.length > 0 && (
        <p className="mt-2 text-[10px] font-semibold text-neutral-500">
          {project.technologies.join(' · ')}
        </p>
      )}
      {project.url && (
        <p className="mt-1 text-[10px] text-neutral-500">
          {project.url.replace(/^https?:\/\//, '')}
        </p>
      )}
    </div>
  );
}
function SummaryHeading({ title, accent }: { title: string; accent: string }) {
  return (
    <h2
      className="mb-2 mt-4 border-b pb-1 text-xs font-bold uppercase tracking-widest"
      style={{ color: accent, borderColor: `${accent}55` }}
    >
      {title}
    </h2>
  );
}
function TechHeading({ title, accent }: { title: string; accent: string }) {
  return (
    <h2 className="mb-2 mt-5 text-xs font-bold" style={{ color: accent }}>
      {title}
    </h2>
  );
}

function PortfolioAppendix({ resume }: { resume: Resume }) {
  return (
    <section className="mt-8 border-t-2 border-black pt-5">
      <h2 className="text-lg font-extrabold">Portfolio highlights</h2>
      <p className="mt-1 text-xs text-neutral-500">Selected work from Apex Resume Studio</p>
      <ProjectList resume={resume} card accent={resume.accentColor ?? '#7c3aed'} />
      <AchievementBlock resume={resume} />
    </section>
  );
}
