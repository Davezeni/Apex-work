'use client';

import type { Document as DocumentType } from 'docx';
import type { Resume } from '@/hooks/use-resume';
import type { ResumeFormatId } from '@apex-work/shared';

const A4 = { width: 11906, height: 16838 };
const LETTER = { width: 12240, height: 15840 };

function safeFilename(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-z0-9\u1200-\u137f]+/gi, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'apex-resume'
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Render the existing styled resume document into a downloadable PDF in-browser. */
export async function downloadResumePdf(
  element: HTMLElement,
  name: string,
  format: ResumeFormatId,
): Promise<void> {
  const html2pdfModule = await import('html2pdf.js');
  const html2pdf = html2pdfModule.default;
  const paper = format === 'letter' ? 'letter' : 'a4';
  await html2pdf()
    .set({
      margin: format === 'one-page' ? [6, 7, 6, 7] : [8, 8, 8, 8],
      filename: `${safeFilename(name)}-${format}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: Math.min(2, window.devicePixelRatio || 1.5),
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      },
      jsPDF: { unit: 'mm', format: paper, orientation: 'portrait' },
    })
    .from(element)
    .save();
}

function text(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function addHeading(Paragraph: any, HeadingLevel: any, title: string, color: string) {
  return new Paragraph({
    text: title,
    heading: HeadingLevel.HEADING_1,
    thematicBreak: true,
    style: 'sectionHeading',
    run: { color, bold: true },
  });
}

function addLine(
  Paragraph: any,
  TextRun: any,
  content: string,
  options: Record<string, unknown> = {},
) {
  return new Paragraph({
    children: [new TextRun({ text: content, font: 'Aptos', size: 21, ...options })],
    spacing: { after: 90 },
  });
}

/** Create a structured DOCX that remains editable in Word/LibreOffice. */
export async function downloadResumeDocx(
  resume: Resume,
  name: string,
  format: ResumeFormatId,
): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Footer } =
    await import('docx');
  const accent = (resume.accentColor ?? '#7c3aed').replace('#', '');
  const page = format === 'letter' ? LETTER : A4;
  const contact = [
    resume.email,
    resume.phone,
    resume.city,
    resume.website,
    resume.linkedin,
    resume.github,
  ]
    .filter(Boolean)
    .map((item) => String(item).replace(/^https?:\/\//, ''))
    .join('  ·  ');
  const children: any[] = [];

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: name, font: 'Aptos Display', bold: true, size: 38, color: accent }),
      ],
      alignment: AlignmentType.LEFT,
      spacing: { after: 100 },
    }),
  );
  if (text(resume.headline))
    children.push(
      addLine(Paragraph, TextRun, text(resume.headline), { bold: true, size: 25, color: '555555' }),
    );
  if (text(resume.targetRole))
    children.push(
      addLine(Paragraph, TextRun, `Target role: ${text(resume.targetRole)}`, {
        bold: true,
        size: 20,
        color: accent,
      }),
    );
  if (contact) children.push(addLine(Paragraph, TextRun, contact, { size: 18, color: '666666' }));

  if (text(resume.summary)) {
    children.push(addHeading(Paragraph, HeadingLevel, 'Profile', accent));
    children.push(addLine(Paragraph, TextRun, text(resume.summary)));
  }
  if (resume.content.skills.length > 0) {
    children.push(addHeading(Paragraph, HeadingLevel, 'Skills', accent));
    children.push(
      addLine(Paragraph, TextRun, resume.content.skills.map((skill) => skill.name).join('  ·  ')),
    );
  }
  if (resume.experiences.length > 0) {
    children.push(addHeading(Paragraph, HeadingLevel, 'Experience', accent));
    for (const item of resume.experiences) {
      children.push(addLine(Paragraph, TextRun, `${item.role} · ${item.company}`, { bold: true }));
      children.push(
        addLine(
          Paragraph,
          TextRun,
          `${item.startYear} – ${item.endYear ?? 'Present'}${item.location ? ` · ${item.location}` : ''}`,
          { size: 18, color: '666666' },
        ),
      );
      if (text(item.description))
        children.push(addLine(Paragraph, TextRun, text(item.description)));
    }
  }
  if (resume.content.projects.length > 0) {
    children.push(addHeading(Paragraph, HeadingLevel, 'Selected projects', accent));
    for (const item of resume.content.projects) {
      children.push(
        addLine(Paragraph, TextRun, `${item.title}${item.role ? ` · ${item.role}` : ''}`, {
          bold: true,
        }),
      );
      if (text(item.description))
        children.push(addLine(Paragraph, TextRun, text(item.description)));
      if (item.highlights.length > 0)
        children.push(
          addLine(
            Paragraph,
            TextRun,
            item.highlights.map((highlight) => `• ${highlight}`).join('\n'),
          ),
        );
      if (item.technologies.length > 0)
        children.push(
          addLine(Paragraph, TextRun, item.technologies.join(' · '), { size: 18, color: '666666' }),
        );
    }
  }
  if (resume.education.length > 0) {
    children.push(addHeading(Paragraph, HeadingLevel, 'Education', accent));
    for (const item of resume.education) {
      children.push(addLine(Paragraph, TextRun, item.school, { bold: true }));
      children.push(
        addLine(
          Paragraph,
          TextRun,
          `${item.degree ?? ''}${item.fieldOfStudy ? ` · ${item.fieldOfStudy}` : ''} · ${item.startYear} – ${item.endYear ?? 'Present'}`,
          { size: 18, color: '666666' },
        ),
      );
      if (text(item.description))
        children.push(addLine(Paragraph, TextRun, text(item.description)));
    }
  }
  if (resume.certifications.length > 0) {
    children.push(addHeading(Paragraph, HeadingLevel, 'Certifications', accent));
    for (const item of resume.certifications)
      children.push(
        addLine(Paragraph, TextRun, `${item.name} — ${item.issuer} (${item.issueYear})`),
      );
  }
  if (resume.content.achievements.length > 0) {
    children.push(addHeading(Paragraph, HeadingLevel, 'Achievements', accent));
    children.push(
      addLine(
        Paragraph,
        TextRun,
        resume.content.achievements.map((item) => `• ${item}`).join('\n'),
      ),
    );
  }
  if (resume.content.volunteer.length > 0) {
    children.push(addHeading(Paragraph, HeadingLevel, 'Volunteer work', accent));
    for (const item of resume.content.volunteer)
      children.push(
        addLine(
          Paragraph,
          TextRun,
          `${item.organization}${item.role ? ` · ${item.role}` : ''}${item.description ? `\n${item.description}` : ''}`,
        ),
      );
  }
  if (resume.content.publications.length > 0) {
    children.push(addHeading(Paragraph, HeadingLevel, 'Publications & speaking', accent));
    children.push(
      addLine(
        Paragraph,
        TextRun,
        resume.content.publications.map((item) => `• ${item}`).join('\n'),
      ),
    );
  }
  if (resume.languages.length > 0) {
    children.push(addHeading(Paragraph, HeadingLevel, 'Languages', accent));
    children.push(addLine(Paragraph, TextRun, resume.languages.join('  ·  ')));
  }

  const doc: DocumentType = new Document({
    styles: {
      paragraphStyles: [
        {
          id: 'sectionHeading',
          name: 'Section heading',
          basedOn: 'Heading 1',
          next: 'Normal',
          run: { font: 'Aptos', size: 24, bold: true, color: accent },
          paragraph: { spacing: { before: 220, after: 100 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: { size: page, margin: { top: 720, right: 800, bottom: 720, left: 800 } },
        },
        children,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                text: 'Created with Apex Resume Studio · apex-work-gold.vercel.app',
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${safeFilename(name)}-${format}.docx`);
}
