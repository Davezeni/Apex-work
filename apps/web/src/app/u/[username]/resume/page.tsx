'use client';

import { dt } from '@/i18n/auto';
import { useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Share2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { usePublicResume } from '@/hooks/use-resume';
import { usePublicUser } from '@/hooks/use-public-user';
import { safeBack } from '@/lib/safe-back';
export default function PublicResumePage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const user = usePublicUser(username);
  const resume = usePublicResume(username);

  useEffect(() => {
    if (user.data?.fullName) document.title = `${user.data.fullName} · CV`;
    return () => {
      document.title = 'Apex-Work';
    };
  }, [user.data?.fullName]);

  if (user.isLoading || resume.isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user.error || !user.data || resume.error || !resume.data) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-extrabold">{dt('CV not available')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This freelancer has not published a Resume Studio CV yet.
          </p>
          <Button asChild variant="brand" className="mt-5">
            <Link href={`/u/${username}`}>{dt('View profile')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const profile = user.data;
  const data = resume.data;
  const accent = data.accentColor ?? '#7c3aed';

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${profile.fullName} · CV`, url: window.location.href });
        return;
      } catch {
        /* cancelled */
      }
    }
    await navigator.clipboard?.writeText(window.location.href);
    toast.success(dt('CV link copied'));
  };

  return (
    <div className="min-h-dvh bg-muted/30 pb-12">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl print:hidden">
        <button
          onClick={() => safeBack(router)}
          aria-label={dt('Back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold">{profile.fullName}&apos;s CV</h1>
          <p className="text-[10px] text-muted-foreground">
            Apex Resume Studio · {data.templateId || data.theme}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={share}>
          <Share2 className="h-4 w-4" /> Share
        </Button>
        <Button type="button" size="sm" variant="brand" onClick={() => window.print()}>
          <Download className="h-4 w-4" /> PDF
        </Button>
      </header>

      <main className="mx-auto max-w-3xl px-3 py-6 sm:px-0">
        <article
          className="resume-public-paper bg-white p-6 text-black shadow-xl sm:p-10"
          style={{ borderTop: `8px solid ${accent}` }}
        >
          <header className="border-b border-neutral-200 pb-5">
            <div className="flex items-start justify-between gap-5">
              <div>
                <h2 className="text-3xl font-black tracking-tight">{profile.fullName}</h2>
                <p className="mt-1 text-sm font-semibold text-neutral-600">
                  {data.headline || profile.title || 'Freelance professional'}
                </p>
                {data.targetRole && (
                  <p
                    className="mt-2 text-xs font-bold uppercase tracking-widest"
                    style={{ color: accent }}
                  >
                    {data.targetRole}
                  </p>
                )}
              </div>
              <div
                className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-xl font-black text-white"
                style={{ backgroundColor: accent }}
              >
                {profile.fullName
                  .split(' ')
                  .map((word) => word[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
              {[data.email, data.phone, data.city, data.website, data.linkedin, data.github]
                .filter(Boolean)
                .map((item) => (
                  <span key={String(item)}>{String(item).replace(/^https?:\/\//, '')}</span>
                ))}
            </div>
          </header>

          {data.summary && (
            <ResumeSection title={dt('Profile')} accent={accent}>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{data.summary}</p>
            </ResumeSection>
          )}
          {data.content.skills.length > 0 && (
            <ResumeSection title={dt('Skills')} accent={accent}>
              <div className="flex flex-wrap gap-2">
                {data.content.skills.map((skill) => (
                  <span
                    key={skill.name}
                    className="rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{ backgroundColor: `${accent}18`, color: accent }}
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            </ResumeSection>
          )}
          {data.experiences.length > 0 && (
            <ResumeSection title={dt('Experience')} accent={accent}>
              {data.experiences.map((item) => (
                <div key={item.id} className="mb-4">
                  <div className="flex flex-wrap justify-between gap-2 text-sm font-bold">
                    <span>
                      {item.role} · {item.company}
                    </span>
                    <span className="text-xs font-normal text-neutral-500">
                      {item.startYear} – {item.endYear ?? 'Present'}
                    </span>
                  </div>
                  {item.location && (
                    <div className="text-xs italic text-neutral-500">{item.location}</div>
                  )}
                  {item.description && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">
                      {item.description}
                    </p>
                  )}
                </div>
              ))}
            </ResumeSection>
          )}
          {data.content.projects.length > 0 && (
            <ResumeSection title={dt('Selected projects')} accent={accent}>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.content.projects.map((item) => (
                  <div
                    key={item.id ?? item.title}
                    className="rounded-xl border border-neutral-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold">{item.title}</h3>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={dt('Open project')}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    {item.role && (
                      <p className="mt-1 text-xs font-semibold" style={{ color: accent }}>
                        {item.role}
                      </p>
                    )}
                    {item.description && (
                      <p className="mt-1 whitespace-pre-wrap text-xs text-neutral-600">
                        {item.description}
                      </p>
                    )}
                    {item.highlights.length > 0 && (
                      <ul className="mt-2 list-disc pl-4 text-xs text-neutral-600">
                        {item.highlights.map((highlight) => (
                          <li key={highlight}>{highlight}</li>
                        ))}
                      </ul>
                    )}
                    {item.technologies.length > 0 && (
                      <p className="mt-2 text-[10px] font-semibold text-neutral-500">
                        {item.technologies.join(' · ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ResumeSection>
          )}
          {data.education.length > 0 && (
            <ResumeSection title={dt('Education')} accent={accent}>
              {data.education.map((item) => (
                <div key={item.id} className="mb-2">
                  <div className="flex justify-between gap-2 text-sm font-bold">
                    <span>{item.school}</span>
                    <span className="text-xs font-normal text-neutral-500">
                      {item.startYear} – {item.endYear ?? 'Present'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600">
                    {item.degree}
                    {item.fieldOfStudy ? ` · ${item.fieldOfStudy}` : ''}
                  </p>
                </div>
              ))}
            </ResumeSection>
          )}
          {data.content.achievements.length > 0 && (
            <ResumeSection title={dt('Achievements')} accent={accent}>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {data.content.achievements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </ResumeSection>
          )}
          {data.certifications.length > 0 && (
            <ResumeSection title={dt('Certifications')} accent={accent}>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {data.certifications.map((item) => (
                  <li key={item.id}>
                    {item.name} — {item.issuer} ({item.issueYear})
                  </li>
                ))}
              </ul>
            </ResumeSection>
          )}
        </article>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 print:hidden">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground">
              Interested in working with {profile.fullName.split(' ')[0]}?
            </p>
          </div>
          <Button asChild size="sm" variant="brand">
            <Link href={`/u/${profile.username}`}>{dt('View profile')}</Link>
          </Button>
        </div>
      </main>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }
          html,
          body {
            background: #fff !important;
          }
          .resume-public-paper {
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function ResumeSection({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5">
      <h2
        className="mb-2 border-b pb-1 text-xs font-black uppercase tracking-widest"
        style={{ color: accent, borderColor: `${accent}55` }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
