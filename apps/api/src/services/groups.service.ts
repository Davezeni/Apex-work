/**
 * Group chats. Built on top of the existing Conversation/ConversationMember
 * models — we just flip `isGroup=true` and use the `title`, `avatarUrl`,
 * `createdById` fields.
 *
 * Membership rules:
 *   • Creator is an admin by default.
 *   • Any admin can add/remove members, rename, change avatar.
 *   • A leaving admin transfers admin to the oldest remaining member so
 *     the group never ends up admin-less.
 *   • Users can only ADD members they don't have a block relationship with.
 */
import { prisma } from '../lib/prisma.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { isBlocked } from './moderation.service.js';

export async function createGroup(creatorId: string, input: { title: string; avatarUrl?: string | null; memberIds: string[] }) {
  const uniqueMembers = Array.from(new Set(input.memberIds.filter((id) => id !== creatorId)));
  if (uniqueMembers.length === 0) throw new BadRequestError('Add at least one other member');

  // Verify every member exists and isn't blocked by/from the creator.
  const users = await prisma.user.findMany({
    where: { id: { in: uniqueMembers }, isActive: true },
    select: { id: true },
  });
  if (users.length !== uniqueMembers.length) throw new BadRequestError('One or more members not found');
  for (const uid of uniqueMembers) {
    if (await isBlocked(creatorId, uid)) {
      throw new ForbiddenError('One of the members has a block relationship with you');
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      isGroup: true,
      title: input.title,
      avatarUrl: input.avatarUrl ?? null,
      createdById: creatorId,
      members: {
        createMany: {
          data: [
            { userId: creatorId, isAdmin: true },
            ...uniqueMembers.map((userId) => ({ userId, isAdmin: false })),
          ],
        },
      },
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
        },
      },
    },
  });
  return conversation;
}

async function assertAdmin(conversationId: string, userId: string) {
  const m = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    include: { conversation: { select: { id: true, isGroup: true } } },
  });
  if (!m) throw new ForbiddenError();
  if (!m.conversation.isGroup) throw new BadRequestError('Not a group chat');
  if (!m.isAdmin) throw new ForbiddenError('Admin only');
  return m;
}

export async function updateGroup(conversationId: string, userId: string, patch: { title?: string; avatarUrl?: string | null }) {
  await assertAdmin(conversationId, userId);
  return prisma.conversation.update({
    where: { id: conversationId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
    },
  });
}

export async function addMember(conversationId: string, byUserId: string, newUserId: string) {
  await assertAdmin(conversationId, byUserId);
  const exists = await prisma.user.findUnique({ where: { id: newUserId }, select: { id: true, isActive: true } });
  if (!exists || !exists.isActive) throw new NotFoundError('User');
  if (await isBlocked(byUserId, newUserId)) throw new ForbiddenError('Block relationship');
  return prisma.conversationMember.upsert({
    where: { conversationId_userId: { conversationId, userId: newUserId } },
    create: { conversationId, userId: newUserId, isAdmin: false },
    update: {},
  });
}

export async function removeMember(conversationId: string, byUserId: string, targetUserId: string) {
  if (byUserId !== targetUserId) await assertAdmin(conversationId, byUserId);
  // Anyone can leave themselves; only admins can remove others.
  await prisma.conversationMember.delete({
    where: { conversationId_userId: { conversationId, userId: targetUserId } },
  }).catch(() => undefined);

  // If we just removed the only remaining admin, promote the oldest remaining member.
  const [remainingAdmins, remainingAny] = await Promise.all([
    prisma.conversationMember.count({ where: { conversationId, isAdmin: true } }),
    prisma.conversationMember.findFirst({
      where: { conversationId },
      orderBy: { joinedAt: 'asc' },
      select: { userId: true },
    }),
  ]);
  if (remainingAdmins === 0 && remainingAny) {
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: remainingAny.userId } },
      data: { isAdmin: true },
    });
  }
  return { ok: true };
}

export async function promoteAdmin(conversationId: string, byUserId: string, targetUserId: string) {
  await assertAdmin(conversationId, byUserId);
  return prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: targetUserId } },
    data: { isAdmin: true },
  });
}
