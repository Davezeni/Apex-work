'use client';

/**
 * The real resume template renderer, shared by:
 *  - /resume/preview (the user's actual CV)
 *  - /resume/templates (live sample previews with dummy data, so
 *    freelancers see exactly what each template looks like BEFORE
 *    unlocking/purchasing it)
 *
 * Pure render: (templateId, resume, name) -> document. No hooks, no data
 * fetching — safe to mount many times on one page (scaled thumbnails).
 */

import { dt } from '@/i18n/auto';
import { cn } from '@/lib/utils';
import type { Resume } from '@/hooks/use-resume';
import type { ResumeTemplateId } from '@apex-work/shared';

/**
 * Realistic sample data used for template previews. Shaped exactly like the
 * user's resume so the same renderer produces the same layouts.
 */
export const SAMPLE_RESUME: Resume = {
  id: 'sample',
  headline: 'Senior Product Designer',
  summary:
    'Product designer with 7+ years shipping fintech and marketplace products across Ethiopia. I turn messy problems into clean, measurable interfaces.',
  phone: '+251 911 234 567',
  email: 'hanna@example.com',
  city: 'Addis Ababa, Ethiopia',
  website: 'https://hanna.design',
  linkedin: 'https://linkedin.com/in/hannagetachew',
  github: null,
  languages: ['Amharic', 'English'],
  theme: 'sample',
  templateId: 'classic',
  targetRole: 'Lead Product Designer',
  accentColor: '#7c3aed',
  isPublic: false,
  content: {
    skills: [
      { name: 'Figma', level: 5, years: 7 },
      { name: 'Design Systems', level: 4, years: 5 },
      { name: 'Prototyping', level: 4, years: 6 },
      { name: 'User Research', level: 3, years: 4 },
      { name: 'Webflow', level: 3, years: 2 },
    ],
    projects: [
      {
        title: 'PayGo — mobile money app',
        role: 'Lead designer',
        description:
          'Redesigned the agent payment flow, lifting daily transactions by 34% across 12k agents.',
        url: null,
        technologies: ['Figma', 'Maze', 'React'],
        highlights: [],
        startYear: 2023,
        endYear: 2024,
      },
    ],
    achievements: [
      'Speaker — Addis Design Week 2024',
      'Awwwards Honorable Mention, PayGo case study',
    ],
    volunteer: [],
    publications: ['Designing for low-bandwidth contexts — UX Ethiopia Journal, 2023'],
    references: [],
  },
  experiences: [
    {
      id: 's1',
      position: 0,
      company: 'Gebeya Inc.',
      role: 'Senior Product Designer',
      location: 'Addis Ababa',
      startYear: 2021,
      startMonth: 3,
      endYear: null,
      endMonth: null,
      description:
        'Own the end-to-end design of the talent marketplace: onboarding, search and payments.',
    },
    {
      id: 's2',
      position: 1,
      company: 'IE Networks',
      role: 'UI Designer',
      location: 'Addis Ababa',
      startYear: 2018,
      startMonth: 7,
      endYear: 2021,
      endMonth: 2,
      description: 'Designed dashboards and design tokens for telecom clients.',
    },
  ],
  education: [
    {
      id: 'e1',
      position: 0,
      school: 'Addis Ababa University',
      degree: 'BSc',
      fieldOfStudy: 'Computer Science',
      startYear: 2014,
      endYear: 2018,
      description: null,
    },
  ],
  certifications: [
    {
      id: 'c1',
      position: 0,
      name: 'Google UX Design Certificate',
      issuer: 'Google',
      issueYear: 2020,
    },
  ],
};

/**
 * Scaled live thumbnail of a template, rendered with SAMPLE_RESUME.
 * Place inside a `relative overflow-hidden` container.
 */
export function ResumeSampleThumb({
  templateId,
  scale = 0.28,
  className,
}: {
  templateId: ResumeTemplateId | string;
  scale?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none select-none overflow-hidden', className)}
      style={{ width: Math.round(760 * scale), height: Math.round(1075 * scale) }}
    >
      {/* Scale the paper itself from its top-left corner so the visible area
          is always the top of the page — never a blank margin. */}
      <div
        className="w-[760px] bg-white text-black shadow-lg ring-1 ring-black/10"
        style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        <div className="min-h-[1075px] p-8">
          <ResumeTemplate templateId={templateId} resume={SAMPLE_RESUME} name="Hanna Getachew" />
        </div>
      </div>
    </div>
  );
}

export function ResumeTemplate({
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
          <h2 className="text-sm font-bold uppercase tracking-wide">
            {dt('Professional Summary')}
          </h2>
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
          <SummaryHeading title={dt('Profile')} accent={accent} />
          {resume.summary && <p className="whitespace-pre-wrap text-sm">{resume.summary}</p>}
          <SummaryHeading title={dt('Experience')} accent={accent} />
          <ExperienceItems resume={resume} />
          <SummaryHeading title={dt('Selected projects')} accent={accent} />
          <ProjectList resume={resume} />
        </div>
        <aside className="col-span-1">
          <SummaryHeading title={dt('Expertise')} accent={accent} />
          <SkillList resume={resume} />
          <SummaryHeading title={dt('Education')} accent={accent} />
          <EducationList resume={resume} />
          <SummaryHeading title={dt('Awards')} accent={accent} />
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
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/70">
          {dt('Portfolio CV')}
        </p>
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
          <TechHeading title={dt('// summary')} accent={accent} />
          {resume.summary && <p className="whitespace-pre-wrap text-sm">{resume.summary}</p>}
          <TechHeading title={dt('// experience')} accent={accent} />
          {resume.experiences.map((item) => (
            <ExperienceItem key={item.id} item={item} compact />
          ))}
          <TechHeading title={dt('// projects')} accent={accent} />
          {resume.content.projects.map((item) => (
            <ProjectCard key={item.id ?? item.title} project={item} accent={accent} />
          ))}
        </div>
        <aside>
          <TechHeading title={dt('// skills')} accent={accent} />
          <SkillList resume={resume} grid accent={accent} />
          <TechHeading title={dt('// education')} accent={accent} />
          <EducationList resume={resume} />
          <TechHeading title={dt('// achievements')} accent={accent} />
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
          <h2 className="text-sm font-bold">{dt('Research profile')}</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm">{resume.summary}</p>
        </section>
      )}
      <section className="mt-5">
        <h2 className="border-b border-black pb-1 text-sm font-bold">
          {dt('Appointments & experience')}
        </h2>
        <ExperienceItems resume={resume} />
      </section>
      <section className="mt-5">
        <h2 className="border-b border-black pb-1 text-sm font-bold">{dt('Education')}</h2>
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
        <Block title={dt('Summary')}>
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
    <Block title={dt('Certifications')}>
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
    <Block title={dt('Achievements')}>
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

export function PortfolioAppendix({ resume }: { resume: Resume }) {
  return (
    <section className="mt-8 border-t-2 border-black pt-5">
      <h2 className="text-lg font-extrabold">{dt('Portfolio highlights')}</h2>
      <p className="mt-1 text-xs text-neutral-500">{dt('Selected work from Apex Resume Studio')}</p>
      <ProjectList resume={resume} card accent={resume.accentColor ?? '#7c3aed'} />
      <AchievementBlock resume={resume} />
    </section>
  );
}
