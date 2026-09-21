import { prisma } from '../lib/prisma.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';

const jobSelect = {
  id: true,
  title: true,
  budgetMinEtb: true,
  budgetMaxEtb: true,
  isRemote: true,
  isOpen: true,
  createdAt: true,
  client: {
    select: {
      id: true,
      username: true,
      fullName: true,
      avatarUrl: true,
    },
  },
  _count: { select: { bids: true } },
  attachments: {
    where: { contentType: { startsWith: 'image/' } },
    take: 1,
    orderBy: { createdAt: 'asc' as const },
    select: { url: true, contentType: true },
  },
} as const;

async function findJob(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
  if (!job) throw new NotFoundError('Job');
  return job;
}

/** Return saved jobs newest first. Closed jobs stay visible so a saved item never disappears silently. */
export async function listMine(userId: string) {
  return prisma.jobSave.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      job: { select: jobSelect },
    },
  });
}

export async function status(userId: string, jobId: string) {
  await findJob(jobId);
  const row = await prisma.jobSave.findUnique({
    where: { userId_jobId: { userId, jobId } },
    select: { id: true },
  });
  return { saved: !!row };
}

/** Idempotent save: repeated taps do not create duplicates. */
export async function save(userId: string, jobId: string) {
  await findJob(jobId);
  const row = await prisma.jobSave.upsert({
    where: { userId_jobId: { userId, jobId } },
    create: { userId, jobId },
    update: {},
    select: { id: true, createdAt: true },
  });
  return { saved: true as const, id: row.id, createdAt: row.createdAt.toISOString() };
}

export async function remove(userId: string, jobId: string) {
  await findJob(jobId);
  await prisma.jobSave.deleteMany({ where: { userId, jobId } });
  return { saved: false as const };
}

/**
 * Defensive ownership check used by future admin/reporting extensions. Kept
 * here so saved-job authorization rules stay in one service boundary.
 */
export async function assertOwner(userId: string, savedJobId: string) {
  const row = await prisma.jobSave.findUnique({
    where: { id: savedJobId },
    select: { userId: true },
  });
  if (!row) throw new NotFoundError('Saved job');
  if (row.userId !== userId) throw new ForbiddenError();
  return row;
}
