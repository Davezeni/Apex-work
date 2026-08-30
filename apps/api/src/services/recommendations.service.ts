import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';

function normalized(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

function score(
  required: string[],
  available: Set<string>,
): { matchScore: number; matchedSkills: string[] } {
  const normalizedRequired = [...new Set(required.map(normalized).filter(Boolean))];
  const matchedSkills = normalizedRequired.filter((skill) => available.has(skill));
  const matchScore =
    normalizedRequired.length === 0
      ? 35
      : Math.min(99, Math.round(35 + (matchedSkills.length / normalizedRequired.length) * 64));
  return { matchScore, matchedSkills };
}

/**
 * Lightweight explainable recommendations. Start with indexed marketplace
 * fields so this remains cheap on the free tier; semantic embeddings can be
 * added later without changing the client contract.
 */
export async function forUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      skills: { select: { skill: { select: { slug: true, name: true } } } },
    },
  });
  if (!user) throw new NotFoundError('User');
  const available = new Set(user.skills.map((row) => normalized(row.skill.slug || row.skill.name)));

  if (user.role === 'FREELANCER') {
    const jobs = await prisma.job.findMany({
      where: { isOpen: true, clientId: { not: userId } },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: {
        id: true,
        title: true,
        description: true,
        categoryId: true,
        budgetMinEtb: true,
        budgetMaxEtb: true,
        requiredSkills: true,
        isRemote: true,
        createdAt: true,
        client: { select: { username: true, fullName: true, avatarUrl: true } },
      },
    });
    const items = jobs
      .map((job) => ({
        ...job,
        ...score(job.requiredSkills, available),
        createdAt: job.createdAt.toISOString(),
      }))
      .sort((a, b) => b.matchScore - a.matchScore || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 12);
    return {
      kind: 'jobs' as const,
      items,
      basedOn: [...user.skills.map((row) => row.skill.name)].slice(0, 8),
    };
  }

  const gigs = await prisma.gig.findMany({
    where: { status: 'ACTIVE', ownerId: { not: userId } },
    orderBy: [{ isFeatured: 'desc' }, { rating: 'desc' }, { createdAt: 'desc' }],
    take: 12,
    select: {
      id: true,
      title: true,
      slug: true,
      coverImageUrl: true,
      categoryId: true,
      tags: true,
      rating: true,
      ratingCount: true,
      startingPriceEtb: true,
      owner: { select: { id: true, username: true, fullName: true, avatarUrl: true, city: true } },
    },
  });
  return {
    kind: 'gigs' as const,
    items: gigs.map((gig) => ({ ...gig, ...score(gig.tags, available) })),
    basedOn: [...user.skills.map((row) => row.skill.name)].slice(0, 8),
  };
}
