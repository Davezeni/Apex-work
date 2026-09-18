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
