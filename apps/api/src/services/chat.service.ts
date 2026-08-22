/**
 * Chat business logic. Kept separate from routes so Socket.io handlers
 * (in realtime/socket.ts) can reuse the same functions.
 */
import type { Message } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { notify } from './notifications.service.js';

/**
 * Get-or-create a 1-to-1 conversation between two users.
 * We look for an EXISTING non-group conversation whose members are exactly
 * {selfId, peerId}. If none, create a new one.
 * This keeps chat history unified across sessions.
 */
export async function getOrCreateDirectConversation(selfId: string, peerId: string) {
  if (selfId === peerId) throw new BadRequestError('Cannot start a conversation with yourself');

  const peer = await prisma.user.findUnique({
    where: { id: peerId },
    select: { id: true, isActive: true },
  });
  if (!peer || !peer.isActive) throw new NotFoundError('User');

  // If either party has blocked the other, refuse to open a new conversation.
  // Existing conversations remain visible; this only blocks *starting* new ones.
  const { isBlocked } = await import('./moderation.service.js');
  if (await isBlocked(selfId, peerId)) {
    throw new (await import('../lib/errors.js')).ForbiddenError(
      'You cannot start a conversation with this user',
    );
  }

  // Find a non-group conversation containing both members.
  // We use a compact intersection query: the conversation IDs where BOTH users are members.
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT c."id"
    FROM "Conversation" c
    JOIN "ConversationMember" m1 ON m1."conversationId" = c."id" AND m1."userId" = ${selfId}
    JOIN "ConversationMember" m2 ON m2."conversationId" = c."id" AND m2."userId" = ${peerId}
    WHERE c."isGroup" = false
    LIMIT 1
  `;

  if (rows.length > 0) {
    return prisma.conversation.findUnique({
      where: { id: rows[0]!.id },
      include: conversationInclude(selfId),
    });
  }

  return prisma.conversation.create({
    data: {
      isGroup: false,
      members: {
        createMany: {
          data: [{ userId: selfId }, { userId: peerId }],
        },
      },
    },
    include: conversationInclude(selfId),
  });
}

/** Ensure a user is a member of a conversation. Throws ForbiddenError if not. */
export async function assertMember(conversationId: string, userId: string) {
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { conversationId: true },
  });
  if (!membership) throw new ForbiddenError('You are not a member of this conversation');
}

export async function listConversations(userId: string) {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    orderBy: [{ conversation: { lastMessageAt: 'desc' } }, { joinedAt: 'desc' }],
    include: {
      conversation: {
        include: {
          members: {
            include: {
              user: {
                select: { id: true, username: true, fullName: true, avatarUrl: true },
              },
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              body: true,
              attachmentType: true,
              senderId: true,
              createdAt: true,
            },
          },
        },
      },
    },
    take: 100,
  });

  return memberships.map((m) => shapeConversation(m.conversation, userId, m.lastReadAt));
}

export async function listMessages(
  conversationId: string,
  userId: string,
  opts: { cursor?: string; limit: number },
) {
  await assertMember(conversationId, userId);
  const items = await prisma.message.findMany({
    where: { conversationId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    include: {
      sender: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
    },
  });
  const hasMore = items.length > opts.limit;
  const trimmed = hasMore ? items.slice(0, opts.limit) : items;
  return {
    // Return in reverse so client can append naturally (oldest → newest).
    items: trimmed.reverse(),
    nextCursor: hasMore ? (trimmed[0]?.id ?? null) : null,
    hasMore,
  };
}

export async function sendMessage(input: {
  conversationId: string;
  senderId: string;
  body?: string;
  attachmentUrl?: string;
  attachmentType?: string;
  replyToId?: string;
}): Promise<Message> {
  await assertMember(input.conversationId, input.senderId);

  const message = await prisma.$transaction(async (tx) => {
    const m = await tx.message.create({
      data: {
        conversationId: input.conversationId,
        senderId: input.senderId,
        body: input.body,
        attachmentUrl: input.attachmentUrl,
        attachmentType: input.attachmentType,
        replyToId: input.replyToId,
      },
      include: {
        sender: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
      },
    });
    await tx.conversation.update({
      where: { id: input.conversationId },
      data: { lastMessageAt: m.createdAt },
    });
    return m;
  });

  // Notify every OTHER member of the conversation (fire-and-forget).
  // Kept outside the transaction: notifications are side effects, not core writes.
  const others = await prisma.conversationMember.findMany({
    where: { conversationId: input.conversationId, userId: { not: input.senderId } },
    select: { userId: true },
  });
  await Promise.all(
    others.map((m) =>
      notify({
        userId: m.userId,
        type: 'NEW_MESSAGE',
        title: `New message from ${message.sender.fullName}`,
        body: (input.body ?? '').slice(0, 140) || '📎 Attachment',
        payload: { conversationId: input.conversationId, messageId: message.id },
      }),
    ),
  );

  return message;
}

export async function markAsRead(conversationId: string, userId: string) {
  await assertMember(conversationId, userId);
  return prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });
}

// ==========================
// Helpers
// ==========================

const conversationInclude = (selfId: string) => ({
  members: {
    include: {
      user: {
        select: { id: true, username: true, fullName: true, avatarUrl: true },
      },
    },
  },
  messages: {
    take: 1,
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      body: true,
      attachmentType: true,
      senderId: true,
      createdAt: true,
    },
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapeConversation(conv: any, selfId: string, lastReadAt: Date | null) {
  const peer = conv.members.find((m: { userId: string }) => m.userId !== selfId)?.user;
  const lastMessage = conv.messages[0] ?? null;
  const unread =
    lastMessage &&
    lastMessage.senderId !== selfId &&
    (!lastReadAt || lastMessage.createdAt > lastReadAt)
      ? 1
      : 0;
  return {
    id: conv.id,
    isGroup: conv.isGroup,
    title: conv.title,
    peer: peer ?? null,
    lastMessage,
    lastMessageAt: conv.lastMessageAt,
    unread,
    updatedAt: conv.updatedAt,
  };
}
