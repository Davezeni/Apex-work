/**
 * Resume / CV service.
 *
 * Resume rows are 1:1 with users. Sub-records (experience/education/certs)
 * are ordered lists with a `position` column so users can reorder.
 * All mutations are scoped to the current user's resume — no way to
 * touch someone else's records.
 */
import { prisma } from '../lib/prisma.js';
import type {
  ResumeInput,
  WorkExperienceInput,
  EducationInput,
  CertificationInput,
} from '@apex-work/shared';
import { NotFoundError } from '../lib/errors.js';

async function ensureResume(userId: string) {
  return prisma.resume.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function getResume(userId: string) {
  await ensureResume(userId);
  return prisma.resume.findUnique({
    where: { userId },
    include: {
      experiences: { orderBy: { position: 'asc' } },
      education: { orderBy: { position: 'asc' } },
      certifications: { orderBy: { position: 'asc' } },
    },
  });
}

/** Public read — used on the freelancer profile page. */
export async function getPublicResume(userId: string) {
  const r = await prisma.resume.findUnique({
    where: { userId },
    include: {
      experiences: { orderBy: { position: 'asc' } },
      education: { orderBy: { position: 'asc' } },
      certifications: { orderBy: { position: 'asc' } },
    },
  });
  return r; // may be null — caller decides how to render
}

export async function updateResume(userId: string, input: ResumeInput) {
  await ensureResume(userId);
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
      languages: input.languages,
      theme: input.theme,
    },
  });
}

// ---------- experience ----------
export async function addExperience(userId: string, input: WorkExperienceInput) {
  const resume = await ensureResume(userId);
  const nextPos = (await prisma.workExperience.count({ where: { resumeId: resume.id } })) ;
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
      company: input.company, role: input.role, location: input.location ?? null,
      startYear: input.startYear, startMonth: input.startMonth,
      endYear: input.endYear ?? null, endMonth: input.endMonth ?? null,
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
      school: input.school, degree: input.degree ?? null, fieldOfStudy: input.fieldOfStudy ?? null,
      startYear: input.startYear, endYear: input.endYear ?? null,
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
      name: input.name, issuer: input.issuer,
      issueYear: input.issueYear, issueMonth: input.issueMonth ?? null,
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
      name: input.name, issuer: input.issuer,
      issueYear: input.issueYear, issueMonth: input.issueMonth ?? null,
      credentialUrl: input.credentialUrl ?? null,
    },
  });
}

export async function deleteCertification(userId: string, id: string) {
  const row = await prisma.certification.findUnique({ where: { id }, include: { resume: true } });
  if (!row || row.resume.userId !== userId) throw new NotFoundError('Certification');
  await prisma.certification.delete({ where: { id } });
}
