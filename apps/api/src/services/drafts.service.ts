/**
 * Message drafts — durable per (user, conversation) copy of unsent text.
 * The client autosaves while typing, and flushes queued sends when it
 * reconnects. Server-side is a straight upsert on the unique (userId,
 * conversationId) key.
 */
import { prisma } from '../lib/prisma.js';
import { assertMember } from './chat.service.js';

export async function upsertDraft(input: {
  userId: string;
  conversationId: string;
  body: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
}) {
  await assertMember(input.conversationId, input.userId);
  return prisma.messageDraft.upsert({
    where: {
      userId_conversationId: {
        userId: input.userId,
        conversationId: input.conversationId,
      },
    },
    create: {
      userId: input.userId,
      conversationId: input.conversationId,
      body: input.body,
      attachmentUrl: input.attachmentUrl ?? null,
      attachmentType: input.attachmentType ?? null,
    },
    update: {
      body: input.body,
      attachmentUrl: input.attachmentUrl ?? null,
      attachmentType: input.attachmentType ?? null,
    },
  });
}

export async function getDraft(userId: string, conversationId: string) {
  return prisma.messageDraft.findUnique({
    where: { userId_conversationId: { userId, conversationId } },
  });
}

export async function deleteDraft(userId: string, conversationId: string) {
  await prisma.messageDraft.deleteMany({
    where: { userId, conversationId },
  });
}

export async function listMyDrafts(userId: string) {
  return prisma.messageDraft.findMany({
    where: { userId, body: { not: '' } },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: {
      conversation: {
        include: {
          members: {
            where: { userId: { not: userId } },
            include: { user: { select: { id: true, username: true, fullName: true, avatarUrl: true } } },
            take: 1,
          },
        },
      },
    },
  });
}
