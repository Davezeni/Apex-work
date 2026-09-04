/**
 * Chat business logic. Kept separate from routes so Socket.io handlers
 * (in realtime/socket.ts) can reuse the same functions.
 */
import type { Message } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { notify } from './notifications.service.js';

/** OAuth-created accounts can browse first, but must verify phone before trust-sensitive chat actions. */
export async function assertPhoneVerified(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true, isPhoneVerified: true },
  });
  if (!user || !user.phone || !user.isPhoneVerified) {
    throw new ConflictError('Verify your phone number before starting or sending a conversation');
  }
}

/**
 * Get-or-create a 1-to-1 conversation between two users.
 * We look for an EXISTING non-group conversation whose members are exactly
 * {selfId, peerId}. If none, create a new one.
 * This keeps chat history unified across sessions.
 */
export async function getOrCreateDirectConversation(selfId: string, peerId: string) {
  await assertPhoneVerified(selfId);
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

/** Full detail for one conversation (used by the chat screen for group UI). */
export async function getConversation(conversationId: string, userId: string) {
  await assertMember(conversationId, userId);
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { lastReadAt: true, isMuted: true, isAdmin: true },
  });
  const conv = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: {
      members: {
        include: { user: { select: { id: true, username: true, fullName: true, avatarUrl: true } } },
      },
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: { id: true, body: true, attachmentType: true, senderId: true, createdAt: true },
      },
    },
  });
  const shaped = shapeConversation(conv, userId, membership?.lastReadAt ?? null);
  return {
    ...shaped,
    createdAt: conv.createdAt,
    members: conv.members.map((m) => ({
      userId: m.userId,
      isAdmin: m.isAdmin,
      joinedAt: m.joinedAt,
      lastReadAt: m.lastReadAt,
      ...m.user,
    })),
    me: { isMuted: membership?.isMuted ?? false, isAdmin: membership?.isAdmin ?? false },
  };
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
      replyTo: {
        select: {
          id: true, body: true, attachmentType: true, senderId: true,
          sender: { select: { fullName: true } },
        },
      },
      reactions: { select: { emoji: true, userId: true } },
    },
  });
  const hasMore = items.length > opts.limit;
  const trimmed = hasMore ? items.slice(0, opts.limit) : items;

  // Read receipts: for each OTHER member, the last time they read the thread.
  // A message is "read by" someone when their lastReadAt >= message.createdAt.
  const readTimes = await prisma.conversationMember.findMany({
    where: { conversationId, userId: { not: userId } },
    select: { userId: true, lastReadAt: true },
  });

  // Compact reactions into { emoji, count, mine } per message so the client
  // renders a chip row without extra plumbing.
  const enriched = trimmed.map((m) => {
    const buckets: Record<string, { emoji: string; count: number; mine: boolean }> = {};
    for (const r of m.reactions) {
      const b = buckets[r.emoji] ?? (buckets[r.emoji] = { emoji: r.emoji, count: 0, mine: false });
      b.count++;
      if (r.userId === userId) b.mine = true;
    }
    const readBy = readTimes.filter((rt) => rt.lastReadAt && rt.lastReadAt >= m.createdAt).length;
    return { ...m, reactions: Object.values(buckets), readBy, readByTotal: readTimes.length };
  });

  return {
    // Return in reverse so client can append naturally (oldest → newest).
    items: enriched.reverse(),
    nextCursor: hasMore ? (enriched[0]?.id ?? null) : null,
    hasMore,
  };
}

export async function sendMessage(input: {
  conversationId: string;
  senderId: string;
  body?: string;
  attachmentUrl?: string;
  attachmentType?: string;
  attachmentMeta?: Record<string, unknown>;
  replyToId?: string;
}): Promise<Message> {
  await assertPhoneVerified(input.senderId);
  await assertMember(input.conversationId, input.senderId);

  const message = await prisma.$transaction(async (tx) => {
    const m = await tx.message.create({
      data: {
        conversationId: input.conversationId,
        senderId: input.senderId,
        body: input.body,
        attachmentUrl: input.attachmentUrl,
        attachmentType: input.attachmentType,
        attachmentMeta: input.attachmentMeta as never,
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

  // Lazy import to avoid a circular dep with push.service.
  const { sendPush } = await import('./push.service.js');
  const previewBody =
    (input.body ?? '').slice(0, 140) ||
    (input.attachmentType === 'audio' ? '🎤 Voice message'
      : input.attachmentType === 'image' ? '📷 Photo'
      : input.attachmentType === 'video' ? '🎬 Video'
      : '📎 Attachment');

  await Promise.all(
    others.map(async (m) => {
      await notify({
        userId: m.userId,
        type: 'NEW_MESSAGE',
        title: `New message from ${message.sender.fullName}`,
        body: previewBody,
        payload: { conversationId: input.conversationId, messageId: message.id },
      });
      // Fire the browser push in the background — never block.
      void sendPush(m.userId, {
        title: message.sender.fullName,
        body: previewBody,
        url: `/messages/${input.conversationId}`,
        tag: `conv-${input.conversationId}`,
      });
    }),
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

/** Create a group room with an initial set of members. */
export async function createGroup(input: {
  ownerId: string;
  title: string;
  memberIds: string[];
  avatarUrl?: string;
}) {
  await assertPhoneVerified(input.ownerId);
  const ids = [...new Set(input.memberIds)];
  if (ids.includes(input.ownerId) || ids.length === 0) {
    throw new BadRequestError('Add at least one other member');
  }
  const count = await prisma.user.count({ where: { id: { in: ids }, isActive: true } });
  if (count !== ids.length) throw new NotFoundError('One or more members not found');

  return prisma.conversation.create({
    data: {
      isGroup: true,
      title: input.title,
      avatarUrl: input.avatarUrl,
      createdById: input.ownerId,
      members: {
        createMany: {
          data: [
            { userId: input.ownerId, isAdmin: true },
            ...ids.map((userId) => ({ userId })),
          ],
        },
      },
    },
    include: conversationInclude(input.ownerId),
  });
}

async function assertGroupAdmin(conversationId: string, userId: string) {
  const conv = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    select: { isGroup: true },
  });
  if (!conv.isGroup) throw new BadRequestError('This is not a group conversation');
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { isAdmin: true },
  });
  if (!member) throw new ForbiddenError('You are not a member of this group');
  if (!member.isAdmin) throw new ForbiddenError('Only group admins can do this');
}

/** Rename or set the group avatar. */
export async function updateGroup(conversationId: string, userId: string, input: { title?: string; avatarUrl?: string | null }) {
  await assertGroupAdmin(conversationId, userId);
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { title: input.title, avatarUrl: input.avatarUrl ?? undefined },
    include: conversationInclude(userId),
  });
}

/** Add members to a group (admin only). */
export async function addGroupMembers(conversationId: string, userId: string, memberIds: string[]) {
  await assertGroupAdmin(conversationId, userId);
  const ids = [...new Set(memberIds)];
  const exists = await prisma.conversationMember.findMany({
    where: { conversationId, userId: { in: ids } },
    select: { userId: true },
  });
  const toAdd = ids.filter((id) => !exists.some((e) => e.userId === id));
  if (toAdd.length === 0) return prisma.conversation.findUniqueOrThrow({ where: { id: conversationId }, include: conversationInclude(userId) });
  await prisma.conversationMember.createMany({
    data: toAdd.map((uid) => ({ conversationId, userId: uid })),
    skipDuplicates: true,
  });
  return prisma.conversation.findUniqueOrThrow({ where: { id: conversationId }, include: conversationInclude(userId) });
}

/** Remove a member (admin removes anyone, or a member leaves themselves). */
export async function removeGroupMember(conversationId: string, actorId: string, memberId: string) {
  await assertMember(conversationId, actorId);
  const target = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: memberId } },
    select: { isAdmin: true },
  });
  if (!target) throw new NotFoundError('Member');
  const self = actorId === memberId;
  if (!self) await assertGroupAdmin(conversationId, actorId);
  if (target.isAdmin && !self) throw new ForbiddenError('Cannot remove a group admin');

  if (self) {
    // Leave: remove our membership. Empty groups are cleaned up lazily.
    await prisma.conversationMember.delete({ where: { conversationId_userId: { conversationId, userId: memberId } } });
    return { ok: true, left: true, members: null };
  }
  await prisma.conversationMember.delete({ where: { conversationId_userId: { conversationId, userId: memberId } } });
  return prisma.conversation.findUniqueOrThrow({ where: { id: conversationId }, include: conversationInclude(actorId) });
}

/** Toggle our emoji reaction on a message. Returns the new reaction state. */
export async function toggleReaction(conversationId: string, messageId: string, userId: string, emoji: string) {
  if (emoji.length > 16) throw new BadRequestError('Emoji too long');
  await assertMember(conversationId, userId);
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { conversationId: true },
  });
  if (!message || message.conversationId !== conversationId) throw new NotFoundError('Message');

  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId, emoji } },
  });
  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
    return { ok: true, added: false, emoji };
  }
  await prisma.messageReaction.create({ data: { messageId, userId, emoji } });
  return { ok: true, added: true, emoji };
}

/** Edit our own message (sets editedAt). */
export async function editMessage(conversationId: string, messageId: string, userId: string, body: string) {
  await assertMember(conversationId, userId);
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { conversationId: true, senderId: true },
  });
  if (!message || message.conversationId !== conversationId) throw new NotFoundError('Message');
  if (message.senderId !== userId) throw new ForbiddenError('You can only edit your own messages');
  if (body.trim().length === 0) throw new BadRequestError('Message cannot be empty');
  return prisma.message.update({
    where: { id: messageId },
    data: { body, editedAt: new Date() },
  });
}

/** Soft-delete a message (sender, or any member for moderation). */
export async function deleteMessage(conversationId: string, messageId: string, userId: string) {
  await assertMember(conversationId, userId);
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { conversationId: true, senderId: true },
  });
  if (!message || message.conversationId !== conversationId) throw new NotFoundError('Message');
  if (message.senderId !== userId) {
    // Non-sender can only delete via an admin/moderator (checked by capability upstream).
    throw new ForbiddenError('You can only delete your own messages');
  }
  return prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date(), body: null, attachmentUrl: null },
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
