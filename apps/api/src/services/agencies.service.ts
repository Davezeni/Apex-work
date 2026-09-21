import { prisma } from '../lib/prisma.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../lib/errors.js';

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

async function uniqueSlug(name: string) {
  const base = slugify(name) || `team-${Date.now().toString(36)}`;
  const existing = await prisma.agency.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const taken = new Set(existing.map((item) => item.slug));
  if (!taken.has(base)) return base;
  for (let index = 2; index < 1000; index += 1) {
    const value = `${base}-${index}`;
    if (!taken.has(value)) return value;
  }
  return `${base}-${Date.now().toString(36)}`;
}

const memberSelect = {
  role: true,
  createdAt: true,
  user: { select: { id: true, username: true, fullName: true, avatarUrl: true, role: true } },
};

export async function listMine(userId: string) {
  return prisma.agency.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    orderBy: { createdAt: 'desc' },
    include: {
      owner: { select: { id: true, username: true, fullName: true } },
      members: { select: memberSelect, orderBy: { createdAt: 'asc' } },
    },
  });
}

export async function create(
  userId: string,
  input: { name: string; bio?: string; website?: string; logoUrl?: string },
) {
  const slug = await uniqueSlug(input.name);
  return prisma.agency.create({
    data: {
      ownerId: userId,
      name: input.name.trim(),
      slug,
      bio: input.bio?.trim() || null,
      website: input.website || null,
      logoUrl: input.logoUrl || null,
      members: { create: { userId, role: 'OWNER' } },
    },
    include: { members: { select: memberSelect } },
  });
}

async function canManage(userId: string, agencyId: string) {
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { id: true, ownerId: true },
  });
  if (!agency) throw new NotFoundError('Team');
  if (agency.ownerId === userId) return agency;
  const manager = await prisma.agencyMember.findUnique({
    where: { agencyId_userId: { agencyId, userId } },
    select: { role: true },
  });
  if (manager?.role !== 'MANAGER')
    throw new ForbiddenError('Only the team owner or a manager can manage members');
  return agency;
}

export async function invite(
  userId: string,
  agencyId: string,
  input: { username: string; role: 'MEMBER' | 'MANAGER' },
) {
  await canManage(userId, agencyId);
  // Forgive the obvious: a leading @ (copied from the member list) and
  // letter case — usernames are matched case-insensitively.
  const handle = input.username.trim().replace(/^@+/, '');
  const target = await prisma.user.findFirst({
    where: { username: { equals: handle, mode: 'insensitive' } },
    select: { id: true, username: true, fullName: true },
  });
  if (!target) throw new NotFoundError('No user with that username');
  try {
    return await prisma.agencyMember.create({
      data: { agencyId, userId: target.id, role: input.role },
      include: {
        user: { select: { id: true, username: true, fullName: true, avatarUrl: true, role: true } },
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002')
      throw new ConflictError('That user is already in this team');
    throw error;
  }
}

/** Owner settings: default payout share offered to an assigned member. */
export async function updateTeam(
  userId: string,
  agencyId: string,
  input: {
    defaultAssigneeSharePct?: number;
    bio?: string | null;
    website?: string | null;
    logoUrl?: string | null;
  },
) {
  await canManage(userId, agencyId);
  return prisma.agency.update({
    where: { id: agencyId },
    data: {
      ...(input.defaultAssigneeSharePct != null
        ? {
            defaultAssigneeSharePct: Math.min(
              100,
              Math.max(0, Math.round(input.defaultAssigneeSharePct)),
            ),
          }
        : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.website !== undefined ? { website: input.website } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
    },
    select: {
      id: true,
      name: true,
      bio: true,
      website: true,
      logoUrl: true,
      defaultAssigneeSharePct: true,
    },
  });
}

/** Owner promotes/demotes between MEMBER and MANAGER. The OWNER role is fixed. */
export async function setMemberRole(
  userId: string,
  agencyId: string,
  memberUserId: string,
  role: 'MEMBER' | 'MANAGER',
) {
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { ownerId: true },
  });
  if (!agency) throw new NotFoundError('Agency');
  if (agency.ownerId !== userId) throw new ForbiddenError('Only the owner can change roles');
  if (memberUserId === agency.ownerId) throw new ConflictError('The owner role is fixed');
  const member = await prisma.agencyMember.findUnique({
    where: { agencyId_userId: { agencyId, userId: memberUserId } },
    select: { userId: true },
  });
  if (!member) throw new NotFoundError('Member');
  return prisma.agencyMember.update({
    where: { agencyId_userId: { agencyId, userId: memberUserId } },
    data: { role },
    select: { userId: true, role: true },
  });
}

const MAX_PROJECTS = 24;

export async function addProject(
  userId: string,
  agencyId: string,
  input: { title: string; description?: string; url?: string; imageUrl?: string },
) {
  await canManage(userId, agencyId);
  const count = await prisma.agencyProject.count({ where: { agencyId } });
  if (count >= MAX_PROJECTS) throw new ConflictError('Max 24 portfolio pieces');
  return prisma.agencyProject.create({
    data: {
      agencyId,
      title: input.title,
      description: input.description ?? null,
      url: input.url ?? null,
      imageUrl: input.imageUrl ?? null,
    },
    select: { id: true, title: true },
  });
}

export async function removeProject(userId: string, agencyId: string, projectId: string) {
  await canManage(userId, agencyId);
  const row = await prisma.agencyProject.findFirst({
    where: { id: projectId, agencyId },
    select: { id: true },
  });
  if (!row) throw new NotFoundError('Portfolio piece');
  await prisma.agencyProject.delete({ where: { id: projectId } });
  return { removed: true as const };
}

/** Pending job invites for a team (owner/manager view). */
export async function listInvites(userId: string, agencyId: string) {
  await canManage(userId, agencyId);
  return prisma.jobAgencyInvite.findMany({
    where: { agencyId },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: {
      id: true,
      createdAt: true,
      message: true,
      job: {
        select: {
          id: true,
          title: true,
          isOpen: true,
          budgetMinEtb: true,
          budgetMaxEtb: true,
        },
      },
      invitedBy: { select: { fullName: true } },
    },
  });
}

/**
 * Owner dashboard per team: pipeline (open bids), active work, completed
 * team orders, plus the same public Team Score inputs.
 */
export async function dashboard(userId: string, agencyId: string) {
  await canManage(userId, agencyId);
  const [openBids, activeOrders, stats] = await Promise.all([
    prisma.bid.count({ where: { agencyId, withdrawnAt: null, job: { isOpen: true } } }),
    prisma.order.count({
      where: { agencyId, status: { in: ['ACTIVE', 'IN_REVIEW', 'DELIVERED'] } },
    }),
    agencyStats(agencyId),
  ]);
  return { openBids, activeOrders, ...stats };
}

/** Open (or create) the team's shared group chat. */
export async function teamChat(userId: string, agencyId: string) {
  const { ensureTeamConversation } = await import('./chat.service.js');
  return ensureTeamConversation({ userId, agencyId });
}

export async function removeMember(userId: string, agencyId: string, memberId: string) {
  await canManage(userId, agencyId);
  const member = await prisma.agencyMember.findUnique({
    where: { agencyId_userId: { agencyId, userId: memberId } },
    select: { role: true },
  });
  if (!member) throw new NotFoundError('Team member');
  if (member.role === 'OWNER') throw new ConflictError('The team owner cannot be removed');
  await prisma.agencyMember.delete({ where: { agencyId_userId: { agencyId, userId: memberId } } });
  return { ok: true };
}

// ================= TEAM SCORE (honest math, no invented data) =================

export interface ScoreOrderRow {
  status: string;
  deadline: Date | null;
  deliveredAt: Date | null;
  clientId: string;
}
export interface ScoreReviewRow {
  rating: number;
  hiddenAt: Date | null;
}

export interface AgencyScore {
  completedOrders: number;
  avgRating: number;
  onTimePct: number;
  repeatClientPct: number;
  badge: 'NONE' | 'RISING' | 'TOP';
}

/**
 * Pure mapper so the numbers are unit-testable. Rules:
 *  - completed = orders with status COMPLETED
 *  - on-time   = of completed orders with a deadline+delivery, % delivered by the deadline
 *  - rating    = average of visible client reviews on team orders
 *  - repeat    = % of clients with more than one completed team order
 *  - TOP badge needs >= 10 completed orders AND rating >= 4.6 AND onTimePct >= 80
 *  - RISING badge for newer teams (1..9 completed) with rating >= 4.5
 */
export function computeAgencyScore(
  orders: ScoreOrderRow[],
  reviews: ScoreReviewRow[],
): AgencyScore {
  const completed = orders.filter((o) => o.status === 'COMPLETED');
  const rated = completed.filter((o) => o.deadline && o.deliveredAt);
  const onTime = rated.filter((o) => o.deliveredAt! <= o.deadline!).length;
  const visible = reviews.filter((r) => !r.hiddenAt);
  const avgRating =
    visible.length > 0
      ? Math.round((visible.reduce((sum, r) => sum + r.rating, 0) / visible.length) * 10) / 10
      : 0;
  const byClient = new Map<string, number>();
  for (const o of completed) byClient.set(o.clientId, (byClient.get(o.clientId) ?? 0) + 1);
  const repeat = [...byClient.values()].filter((n) => n > 1).length;
  const repeatClientPct = byClient.size > 0 ? Math.round((repeat / byClient.size) * 100) : 0;
  const onTimePct = rated.length > 0 ? Math.round((onTime / rated.length) * 100) : 0;
  let badge: AgencyScore['badge'] = 'NONE';
  if (completed.length >= 10 && avgRating >= 4.6 && onTimePct >= 80) badge = 'TOP';
  else if (completed.length >= 1 && completed.length < 10 && avgRating >= 4.5) badge = 'RISING';
  return { completedOrders: completed.length, avgRating, onTimePct, repeatClientPct, badge };
}

/** Live Team Score for an agency, from real orders + visible client reviews. */
export async function agencyStats(agencyId: string): Promise<AgencyScore> {
  const [orders, reviews] = await Promise.all([
    prisma.order.findMany({
      where: { agencyId, status: { in: ['COMPLETED', 'IN_REVIEW', 'DELIVERED'] } },
      select: { status: true, deadline: true, deliveredAt: true, clientId: true },
    }),
    prisma.review.findMany({
      where: { order: { agencyId }, hiddenAt: null },
      select: { rating: true, hiddenAt: true },
    }),
  ]);
  return computeAgencyScore(orders as ScoreOrderRow[], reviews as ScoreReviewRow[]);
}

/** Latest visible client reviews on this team's orders (public storefront). */
export async function agencyReviews(agencyId: string, take = 5) {
  return prisma.review.findMany({
    where: { order: { agencyId }, hiddenAt: null },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      rating: true,
      comment: true,
      createdAt: true,
      author: { select: { fullName: true } },
    },
  });
}
