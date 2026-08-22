'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import { useMyResume } from '@/hooks/use-resume';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Resume preview / print-ready view. Uses window.print() to produce a PDF
 * client-side — the @media print CSS below tightens margins, hides the
 * header, and stretches to A4. No puppeteer/server needed.
 */
export default function ResumePreviewPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: me } = useMe();
  const { data: resume, isLoading } = useMyResume();

  useEffect(() => {
    document.title = `${me?.fullName ?? 'My'} · Resume`;
    return () => { document.title = 'Apex-Work'; };
  }, [me]);

  if (isLoading || !resume || !me) {
    return <div className="grid min-h-dvh place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const theme = resume.theme;

  return (
    <div className="min-h-dvh bg-muted/40 pb-24">
      {/* Toolbar — hidden on print */}
      <header className="print:hidden safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} aria-label={t('common.back')} className="grid h-9 w-9 place-items-center rounded-full active:scale-90">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">Preview</h1>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button size="sm" variant="brand" onClick={() => window.print()}>
            <Download className="h-4 w-4" /> PDF
          </Button>
        </div>
      </header>

      {/* Paper */}
      <div className={cn('mx-auto my-6 max-w-3xl bg-white text-black shadow-xl print:my-0 print:max-w-none print:shadow-none', 'p-6 sm:p-10 print:p-8')}>
        {theme === 'modern' ? <ModernTheme resume={resume} name={me.fullName} /> :
          theme === 'minimal' ? <MinimalTheme resume={resume} name={me.fullName} /> :
            <ClassicTheme resume={resume} name={me.fullName} />}
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          html, body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

type Resume = NonNullable<ReturnType<typeof useMyResume>['data']>;

function periodLabel(sy: number, sm: number, ey: number | null | undefined, em: number | null | undefined) {
  const s = `${String(sm).padStart(2, '0')}/${sy}`;
  const e = ey ? `${String(em ?? 12).padStart(2, '0')}/${ey}` : 'Present';
  return `${s} – ${e}`;
}

function ClassicTheme({ resume, name }: { resume: Resume; name: string }) {
  return (
    <div className="font-serif leading-relaxed">
      <header className="border-b border-black pb-3">
        <h1 className="text-3xl font-extrabold tracking-tight">{name}</h1>
        {resume.headline && <p className="mt-1 text-base font-semibold text-neutral-700">{resume.headline}</p>}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
          {resume.email && <span>{resume.email}</span>}
          {resume.phone && <span>· {resume.phone}</span>}
          {resume.city && <span>· {resume.city}</span>}
          {resume.website && <span>· {resume.website}</span>}
          {resume.linkedin && <span>· {resume.linkedin.replace(/^https?:\/\//, '')}</span>}
          {resume.github && <span>· {resume.github.replace(/^https?:\/\//, '')}</span>}
        </div>
      </header>
      {resume.summary && (
        <Block title="Summary">
          <p className="whitespace-pre-wrap text-sm">{resume.summary}</p>
        </Block>
      )}
      {resume.experiences.length > 0 && (
        <Block title="Experience">
          {resume.experiences.map((e) => (
            <div key={e.id} className="mb-3">
              <div className="flex justify-between text-sm font-bold">
                <span>{e.role} · {e.company}</span>
                <span className="text-xs font-normal text-neutral-600">{periodLabel(e.startYear, e.startMonth, e.endYear, e.endMonth)}</span>
              </div>
              {e.location && <div className="text-xs italic text-neutral-600">{e.location}</div>}
              {e.description && <p className="mt-1 whitespace-pre-wrap text-sm">{e.description}</p>}
            </div>
          ))}
        </Block>
      )}
      {resume.education.length > 0 && (
        <Block title="Education">
          {resume.education.map((e) => (
            <div key={e.id} className="mb-2">
              <div className="flex justify-between text-sm font-bold">
                <span>{e.school}</span>
                <span className="text-xs font-normal text-neutral-600">{e.startYear} – {e.endYear ?? 'Present'}</span>
              </div>
              <div className="text-xs">{e.degree}{e.fieldOfStudy ? ` · ${e.fieldOfStudy}` : ''}</div>
            </div>
          ))}
        </Block>
      )}
      {resume.certifications.length > 0 && (
        <Block title="Certifications">
          <ul className="ml-4 list-disc text-sm">
            {resume.certifications.map((c) => (
              <li key={c.id}>{c.name} — {c.issuer} ({c.issueYear})</li>
            ))}
          </ul>
        </Block>
      )}
      {resume.languages.length > 0 && (
        <Block title="Languages">
          <p className="text-sm">{resume.languages.join(' · ')}</p>
        </Block>
      )}
    </div>
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

function ModernTheme({ resume, name }: { resume: Resume; name: string }) {
  return (
    <div className="grid grid-cols-3 gap-6 font-sans leading-relaxed">
      <aside className="col-span-1 bg-neutral-900 p-4 text-neutral-100 print:bg-neutral-900">
        <h1 className="text-2xl font-extrabold">{name}</h1>
        {resume.headline && <p className="mt-1 text-xs opacity-80">{resume.headline}</p>}
        <div className="mt-3 space-y-1 text-[11px]">
          {resume.email && <div>{resume.email}</div>}
          {resume.phone && <div>{resume.phone}</div>}
          {resume.city && <div>{resume.city}</div>}
          {resume.website && <div>{resume.website}</div>}
          {resume.linkedin && <div>{resume.linkedin.replace(/^https?:\/\//, '')}</div>}
          {resume.github && <div>{resume.github.replace(/^https?:\/\//, '')}</div>}
        </div>
        {resume.languages.length > 0 && (
          <div className="mt-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-70">Languages</h3>
            <ul className="mt-1 text-xs">{resume.languages.map((l) => <li key={l}>{l}</li>)}</ul>
          </div>
        )}
      </aside>
      <div className="col-span-2 space-y-4">
        {resume.summary && <p className="whitespace-pre-wrap text-sm text-neutral-800">{resume.summary}</p>}
        {resume.experiences.length > 0 && (
          <section>
            <h2 className="mb-2 border-b border-neutral-300 pb-1 text-xs font-bold uppercase tracking-widest text-neutral-500">Experience</h2>
            {resume.experiences.map((e) => (
              <div key={e.id} className="mb-3">
                <div className="text-sm font-bold">{e.role}</div>
                <div className="text-xs text-neutral-600">{e.company}{e.location ? ` · ${e.location}` : ''} · {periodLabel(e.startYear, e.startMonth, e.endYear, e.endMonth)}</div>
                {e.description && <p className="mt-1 whitespace-pre-wrap text-sm">{e.description}</p>}
              </div>
            ))}
          </section>
        )}
        {resume.education.length > 0 && (
          <section>
            <h2 className="mb-2 border-b border-neutral-300 pb-1 text-xs font-bold uppercase tracking-widest text-neutral-500">Education</h2>
            {resume.education.map((e) => (
              <div key={e.id} className="mb-2">
                <div className="text-sm font-bold">{e.school}</div>
                <div className="text-xs">{e.degree}{e.fieldOfStudy ? ` · ${e.fieldOfStudy}` : ''} · {e.startYear}–{e.endYear ?? 'Present'}</div>
              </div>
            ))}
          </section>
        )}
        {resume.certifications.length > 0 && (
          <section>
            <h2 className="mb-2 border-b border-neutral-300 pb-1 text-xs font-bold uppercase tracking-widest text-neutral-500">Certifications</h2>
            <ul className="ml-4 list-disc text-sm">
              {resume.certifications.map((c) => (
                <li key={c.id}>{c.name} — {c.issuer} ({c.issueYear})</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function MinimalTheme({ resume, name }: { resume: Resume; name: string }) {
  return (
    <div className="font-sans leading-relaxed">
      <h1 className="text-4xl font-light tracking-tight">{name}</h1>
      {resume.headline && <p className="mt-1 text-sm text-neutral-600">{resume.headline}</p>}
      <p className="mt-3 text-xs text-neutral-500">
        {[resume.email, resume.phone, resume.city, resume.website, resume.linkedin, resume.github]
          .filter(Boolean).join(' · ')}
      </p>
      {resume.summary && (
        <p className="mt-6 whitespace-pre-wrap text-sm">{resume.summary}</p>
      )}
      {resume.experiences.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400">Experience</h2>
          <hr className="mb-3 mt-1 border-neutral-300" />
          {resume.experiences.map((e) => (
            <div key={e.id} className="mb-4">
              <div className="text-sm font-bold">{e.role} — {e.company}</div>
              <div className="text-xs text-neutral-500">{periodLabel(e.startYear, e.startMonth, e.endYear, e.endMonth)}{e.location ? ` · ${e.location}` : ''}</div>
              {e.description && <p className="mt-1 whitespace-pre-wrap text-sm">{e.description}</p>}
            </div>
          ))}
        </section>
      )}
      {resume.education.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400">Education</h2>
          <hr className="mb-3 mt-1 border-neutral-300" />
          {resume.education.map((e) => (
            <div key={e.id} className="mb-2 text-sm">
              <span className="font-bold">{e.school}</span>{e.degree ? ` — ${e.degree}` : ''} <span className="text-xs text-neutral-500">({e.startYear}–{e.endYear ?? 'Present'})</span>
            </div>
          ))}
        </section>
      )}
      {(resume.certifications.length > 0 || resume.languages.length > 0) && (
        <section className="mt-6 grid grid-cols-2 gap-6">
          {resume.certifications.length > 0 && (
            <div>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400">Certifications</h2>
              <ul className="mt-2 text-sm">{resume.certifications.map((c) => <li key={c.id}>{c.name}, {c.issuer}</li>)}</ul>
            </div>
          )}
          {resume.languages.length > 0 && (
            <div>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400">Languages</h2>
              <p className="mt-2 text-sm">{resume.languages.join(' · ')}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
