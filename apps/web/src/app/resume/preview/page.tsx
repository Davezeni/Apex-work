'use client';

import { dt } from '@/i18n/auto';
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
import { PortfolioAppendix, ResumeTemplate } from '@/components/resume/resume-document';
import { useMyResume, type Resume } from '@/hooks/use-resume';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import {
  RESUME_FORMATS,
  RESUME_TEMPLATES,
  type ResumeFormatId,
  type ResumeTemplateId,
} from '@apex-work/shared';
import { safeBack } from '@/lib/safe-back';

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
    if (!element) return toast.error(dt('Resume preview is not ready yet'));
    setExporting('pdf');
    try {
      await downloadResumePdf(element, me.fullName, format);
      toast.success(dt('PDF downloaded'));
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
      toast.success(dt('Editable DOCX downloaded'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'DOCX export failed');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="min-h-dvh bg-muted/40 pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl sm:gap-3 print:hidden">
        <button
          onClick={() => safeBack(router)}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold tracking-tight">{dt('Resume preview')}</h1>
          <p className="truncate text-[10px] text-muted-foreground">
            {template?.name ?? 'Apex template'} · {formatName(format)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href="/resume/templates" aria-label={dt('Templates')}>
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">{dt('Templates')}</span>
            </Link>
          </Button>
          <select
            value={format}
            onChange={(event) => setFormat(safeFormat(event.target.value))}
            aria-label={dt('PDF format')}
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
            className="shrink-0"
            onClick={() => window.print()}
            title={dt('Print or save as PDF')}
          >
            <Printer className="h-4 w-4" /> <span className="hidden sm:inline">{dt('Print')}</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDocxDownload}
            disabled={!!exporting}
            title={dt('Download an editable Word document')}
          >
            {exporting === 'docx' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}{' '}
            <span className="hidden sm:inline">{dt('DOCX')}</span>
          </Button>
          <Button
            size="sm"
            variant="brand"
            className="shrink-0"
            onClick={handlePdfDownload}
            disabled={!!exporting}
            title={dt('Download a PDF file')}
            aria-label={dt('Download a PDF file')}
          >
            {exporting === 'pdf' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">PDF</span>
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
