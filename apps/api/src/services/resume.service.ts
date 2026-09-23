/**
 * Resume / CV service.
 *
 * Resume rows are 1:1 with users. Sub-records (experience/education/certs)
 * are ordered lists with a `position` column so users can reorder.
 * All mutations are scoped to the current user's resume — no way to
 * touch someone else's records.
 */
import { prisma } from '../lib/prisma.js';
import { resumeContentSchema } from '@apex-work/shared';
import type {
  CertificationInput,
  EducationInput,
  ResumeImportInput,
  ResumeInput,
  WorkExperienceInput,
} from '@apex-work/shared';
import { NotFoundError } from '../lib/errors.js';
import { assertUnlocked } from './resumeTemplates.service.js';

async function ensureResume(userId: string) {
  return prisma.resume.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

/**
 * Whole-CV import. 'replace' mode wipes the existing experiences, education
 * and certifications and inserts the imported ones — all inside ONE
 * transaction, so an interrupted import can never leave a half-replaced CV.
 * The profile (headline/summary/contact/languages/content) is overwritten
 * with whatever the import provides (missing fields fall back to the stored
 * values so a CV without an email, say, does not erase the user's email).
 */
export async function importResume(userId: string, input: ResumeImportInput) {
  const existing = await ensureResume(userId);
  const replace = input.mode !== 'merge';
  const profile: ResumeInput = input.profile ?? ({} as ResumeInput);
  const emptyContent = resumeContentSchema.parse({});

  return prisma.$transaction(async (tx) => {
    const removed = { experiences: 0, education: 0, certifications: 0 };
    if (replace) {
      removed.experiences = (
        await tx.workExperience.deleteMany({ where: { resumeId: existing.id } })
      ).count;
      removed.education = (
        await tx.education.deleteMany({ where: { resumeId: existing.id } })
      ).count;
      removed.certifications = (
        await tx.certification.deleteMany({ where: { resumeId: existing.id } })
      ).count;
    }

    const basePos = replace
      ? 0
      : await tx.workExperience.count({ where: { resumeId: existing.id } });
    if (input.experiences.length > 0) {
      await tx.workExperience.createMany({
        data: input.experiences.map((e, i) => ({
          resumeId: existing.id,
          company: e.company,
          role: e.role,
          location: e.location ?? null,
          startYear: e.startYear,
          startMonth: e.startMonth,
          endYear: e.endYear ?? null,
          endMonth: e.endMonth ?? null,
          description: e.description ?? null,
          position: basePos + i,
        })),
      });
    }

    const baseEdu = replace ? 0 : await tx.education.count({ where: { resumeId: existing.id } });
    if (input.education.length > 0) {
      await tx.education.createMany({
        data: input.education.map((d, i) => ({
          resumeId: existing.id,
          school: d.school,
          degree: d.degree ?? null,
          fieldOfStudy: d.fieldOfStudy ?? null,
          startYear: d.startYear,
          endYear: d.endYear ?? null,
          description: d.description ?? null,
          position: baseEdu + i,
        })),
      });
    }

    const baseCert = replace
      ? 0
      : await tx.certification.count({ where: { resumeId: existing.id } });
    if (input.certifications.length > 0) {
      await tx.certification.createMany({
        data: input.certifications.map((c, i) => ({
          resumeId: existing.id,
          name: c.name,
          issuer: c.issuer,
          issueYear: c.issueYear,
          issueMonth: c.issueMonth ?? null,
          credentialUrl: null,
          position: baseCert + i,
        })),
      });
    }

    const storedContent = parsedContent((existing as { contentJson?: unknown }).contentJson);
    const importedContent = profile.content
      ? parsedContent(profile.content as unknown)
      : emptyContent;
    const content = replace
      ? {
          ...emptyContent,
          skills: importedContent.skills,
          projects: importedContent.projects,
          achievements: importedContent.achievements,
        }
      : storedContent;

    const updated = await tx.resume.update({
      where: { userId },
      data: {
        headline: profile.headline ?? existing.headline,
        summary: profile.summary ?? existing.summary,
        phone: profile.phone ?? existing.phone,
        email: profile.email ?? existing.email,
        city: profile.city ?? existing.city,
        website: profile.website ?? existing.website,
        linkedin: profile.linkedin ?? existing.linkedin,
        github: profile.github ?? existing.github,
        targetRole: profile.targetRole ?? existing.targetRole,
        languages: replace
          ? (profile.languages ?? [])
          : Array.from(new Set([...existing.languages, ...(profile.languages ?? [])])),
        contentJson: content as never,
      },
    });

    return {
      resume: updated,
      counts: {
        replaced: replace,
        removed,
        experiences: input.experiences.length,
        education: input.education.length,
        certifications: input.certifications.length,
      },
    };
  });
}

function parsedContent(value: unknown) {
  const result = resumeContentSchema.safeParse(value ?? {});
  return result.success ? result.data : resumeContentSchema.parse({});
}

function withStudioContent<T extends { contentJson: unknown }>(resume: T) {
  return { ...resume, content: parsedContent(resume.contentJson) };
}

export async function getResume(userId: string) {
  await ensureResume(userId);
  const resume = await prisma.resume.findUnique({
    where: { userId },
    include: {
      experiences: { orderBy: { position: 'asc' } },
      education: { orderBy: { position: 'asc' } },
      certifications: { orderBy: { position: 'asc' } },
    },
  });
  return resume ? withStudioContent(resume) : null;
}

/** Public read — used on the freelancer profile page and share links. */
export async function getPublicResume(userId: string) {
  const resume = await prisma.resume.findUnique({
    where: { userId },
    include: {
      experiences: { orderBy: { position: 'asc' } },
      education: { orderBy: { position: 'asc' } },
      certifications: { orderBy: { position: 'asc' } },
    },
  });
  if (!resume || !resume.isPublic) return null;
  return withStudioContent(resume);
}

export async function updateResume(userId: string, input: ResumeInput) {
  await ensureResume(userId);
  const selectedTemplate = input.templateId
    ? await assertUnlocked(userId, input.templateId)
    : undefined;
  return prisma.resume.update({
    where: { userId },
    data: {
      headline: input.headline ?? null,
      summary: input.summary ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      city: input.city ?? null,
      website: input.website ?? null,
      linkedin: input.linkedin ?? null,
      github: input.github ?? null,
      targetRole: input.targetRole ?? null,
      accentColor: input.accentColor ?? null,
      templateId: selectedTemplate?.id ?? undefined,
      theme: selectedTemplate?.id ?? input.theme ?? undefined,
      contentJson: input.content ? (input.content as never) : undefined,
      isPublic: input.isPublic ?? undefined,
      languages: input.languages,
    },
  });
}

// ---------- experience ----------
export async function addExperience(userId: string, input: WorkExperienceInput) {
  const resume = await ensureResume(userId);
  const nextPos = await prisma.workExperience.count({ where: { resumeId: resume.id } });
  return prisma.workExperience.create({
    data: {
      resumeId: resume.id,
      company: input.company,
      role: input.role,
      location: input.location ?? null,
      startYear: input.startYear,
      startMonth: input.startMonth,
      endYear: input.endYear ?? null,
      endMonth: input.endMonth ?? null,
      description: input.description ?? null,
      position: nextPos,
    },
  });
}

export async function updateExperience(userId: string, id: string, input: WorkExperienceInput) {
  const exp = await prisma.workExperience.findUnique({ where: { id }, include: { resume: true } });
  if (!exp || exp.resume.userId !== userId) throw new NotFoundError('Experience');
  return prisma.workExperience.update({
    where: { id },
    data: {
      company: input.company,
      role: input.role,
      location: input.location ?? null,
      startYear: input.startYear,
      startMonth: input.startMonth,
      endYear: input.endYear ?? null,
      endMonth: input.endMonth ?? null,
      description: input.description ?? null,
    },
  });
}

export async function deleteExperience(userId: string, id: string) {
  const exp = await prisma.workExperience.findUnique({ where: { id }, include: { resume: true } });
  if (!exp || exp.resume.userId !== userId) throw new NotFoundError('Experience');
  await prisma.workExperience.delete({ where: { id } });
}

// ---------- education ----------
export async function addEducation(userId: string, input: EducationInput) {
  const resume = await ensureResume(userId);
  const nextPos = await prisma.education.count({ where: { resumeId: resume.id } });
  return prisma.education.create({
    data: {
      resumeId: resume.id,
      school: input.school,
      degree: input.degree ?? null,
      fieldOfStudy: input.fieldOfStudy ?? null,
      startYear: input.startYear,
      endYear: input.endYear ?? null,
      description: input.description ?? null,
      position: nextPos,
    },
  });
}

export async function updateEducation(userId: string, id: string, input: EducationInput) {
  const row = await prisma.education.findUnique({ where: { id }, include: { resume: true } });
  if (!row || row.resume.userId !== userId) throw new NotFoundError('Education');
  return prisma.education.update({
    where: { id },
    data: {
      school: input.school,
      degree: input.degree ?? null,
      fieldOfStudy: input.fieldOfStudy ?? null,
      startYear: input.startYear,
      endYear: input.endYear ?? null,
      description: input.description ?? null,
    },
  });
}

export async function deleteEducation(userId: string, id: string) {
  const row = await prisma.education.findUnique({ where: { id }, include: { resume: true } });
  if (!row || row.resume.userId !== userId) throw new NotFoundError('Education');
  await prisma.education.delete({ where: { id } });
}

// ---------- certifications ----------
export async function addCertification(userId: string, input: CertificationInput) {
  const resume = await ensureResume(userId);
  const nextPos = await prisma.certification.count({ where: { resumeId: resume.id } });
  return prisma.certification.create({
    data: {
      resumeId: resume.id,
      name: input.name,
      issuer: input.issuer,
      issueYear: input.issueYear,
      issueMonth: input.issueMonth ?? null,
      credentialUrl: input.credentialUrl ?? null,
      position: nextPos,
    },
  });
}

export async function updateCertification(userId: string, id: string, input: CertificationInput) {
  const row = await prisma.certification.findUnique({ where: { id }, include: { resume: true } });
  if (!row || row.resume.userId !== userId) throw new NotFoundError('Certification');
  return prisma.certification.update({
    where: { id },
    data: {
      name: input.name,
      issuer: input.issuer,
      issueYear: input.issueYear,
      issueMonth: input.issueMonth ?? null,
      credentialUrl: input.credentialUrl ?? null,
    },
  });
}

export async function deleteCertification(userId: string, id: string) {
  const row = await prisma.certification.findUnique({ where: { id }, include: { resume: true } });
  if (!row || row.resume.userId !== userId) throw new NotFoundError('Certification');
  await prisma.certification.delete({ where: { id } });
}
