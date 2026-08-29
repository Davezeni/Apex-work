import { resumeVersionSnapshotSchema, type ResumeVersionSnapshot } from '@apex-work/shared';
import { prisma } from '../lib/prisma.js';
import { ConflictError, NotFoundError } from '../lib/errors.js';
import { assertUnlocked } from './resumeTemplates.service.js';
import { getResume } from './resume.service.js';

const resumeInclude = {
  experiences: { orderBy: { position: 'asc' as const } },
  education: { orderBy: { position: 'asc' as const } },
  certifications: { orderBy: { position: 'asc' as const } },
};

async function ensureResume(userId: string) {
  return prisma.resume.upsert({ where: { userId }, create: { userId }, update: {} });
}

async function currentSnapshot(userId: string): Promise<ResumeVersionSnapshot> {
  const resume = await ensureResume(userId);
  const full = await prisma.resume.findUnique({ where: { id: resume.id }, include: resumeInclude });
  if (!full) throw new NotFoundError('Resume');

  return resumeVersionSnapshotSchema.parse({
    headline: full.headline,
    summary: full.summary,
    phone: full.phone,
    email: full.email,
    city: full.city,
    website: full.website,
    linkedin: full.linkedin,
    github: full.github,
    targetRole: full.targetRole,
    accentColor: full.accentColor,
    templateId: full.templateId,
    theme: full.theme,
    isPublic: full.isPublic,
    languages: full.languages,
    content: full.contentJson ?? {},
    experiences: full.experiences.map(
      ({
        company,
        role,
        location,
        startYear,
        startMonth,
        endYear,
        endMonth,
        description,
        position,
      }) => ({
        company,
        role,
        location,
        startYear,
        startMonth,
        endYear,
        endMonth,
        description,
        position,
      }),
    ),
    education: full.education.map(
      ({ school, degree, fieldOfStudy, startYear, endYear, description, position }) => ({
        school,
        degree,
        fieldOfStudy,
        startYear,
        endYear,
        description,
        position,
      }),
    ),
    certifications: full.certifications.map(
      ({ name, issuer, issueYear, issueMonth, credentialUrl, position }) => ({
        name,
        issuer,
        issueYear,
        issueMonth,
        credentialUrl,
        position,
      }),
    ),
  });
}

export async function create(userId: string, name: string) {
  const snapshot = await currentSnapshot(userId);
  const row = await prisma.resumeVersion.create({
    data: {
      userId,
      name: name.trim(),
      targetRole: snapshot.targetRole ?? null,
      templateId: snapshot.templateId ?? snapshot.theme ?? 'classic',
      snapshotJson: snapshot as never,
    },
    select: { id: true, name: true, targetRole: true, templateId: true, createdAt: true },
  });

  // Keep the product tidy on the free tier: the newest 20 snapshots remain.
  const old = await prisma.resumeVersion.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip: 20,
    select: { id: true },
  });
  if (old.length > 0)
    await prisma.resumeVersion.deleteMany({ where: { id: { in: old.map((item) => item.id) } } });
  return row;
}

export async function list(userId: string) {
  return prisma.resumeVersion.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, targetRole: true, templateId: true, createdAt: true },
  });
}

export async function restore(userId: string, versionId: string) {
  const row = await prisma.resumeVersion.findFirst({
    where: { id: versionId, userId },
    select: { id: true, snapshotJson: true },
  });
  if (!row) throw new NotFoundError('Resume version');

  const snapshot = resumeVersionSnapshotSchema.safeParse(row.snapshotJson);
  if (!snapshot.success) throw new ConflictError('This resume version is no longer compatible');
  const data = snapshot.data;
  const templateId = data.templateId ?? data.theme ?? 'classic';
  await assertUnlocked(userId, templateId);
  const resume = await ensureResume(userId);

  await prisma.$transaction(async (tx) => {
    await tx.resume.update({
      where: { id: resume.id },
      data: {
        headline: data.headline ?? null,
        summary: data.summary ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        city: data.city ?? null,
        website: data.website ?? null,
        linkedin: data.linkedin ?? null,
        github: data.github ?? null,
        targetRole: data.targetRole ?? null,
        accentColor: data.accentColor ?? null,
        templateId,
        theme: data.theme ?? templateId,
        isPublic: data.isPublic ?? true,
        languages: data.languages,
        contentJson: data.content as never,
      },
    });
    await tx.workExperience.deleteMany({ where: { resumeId: resume.id } });
    await tx.education.deleteMany({ where: { resumeId: resume.id } });
    await tx.certification.deleteMany({ where: { resumeId: resume.id } });

    if (data.experiences.length > 0) {
      await tx.workExperience.createMany({
        data: data.experiences.map((item) => ({ ...item, resumeId: resume.id })),
      });
    }
    if (data.education.length > 0) {
      await tx.education.createMany({
        data: data.education.map((item) => ({ ...item, resumeId: resume.id })),
      });
    }
    if (data.certifications.length > 0) {
      await tx.certification.createMany({
        data: data.certifications.map((item) => ({ ...item, resumeId: resume.id })),
      });
    }
  });

  return getResume(userId);
}

export async function remove(userId: string, versionId: string) {
  const result = await prisma.resumeVersion.deleteMany({ where: { id: versionId, userId } });
  if (result.count === 0) throw new NotFoundError('Resume version');
  return { ok: true };
}
