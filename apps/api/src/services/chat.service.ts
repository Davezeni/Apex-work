/**
 * Chat business logic. Kept separate from routes so Socket.io handlers
 * (in realtime/socket.ts) can reuse the same functions.
 */
import type { Message } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { notify } from './notifications.service.js';
import { isOnline } from './presence.service.js';

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

/** True if `userId` is a member of `conversationId`. */
export async function isMember(conversationId: string, userId: string): Promise<boolean> {
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { conversationId: true },
  });
  return !!membership;
}

/**
 * Assert that BOTH users belong to the conversation. Used to gate WebRTC
 * signaling so a caller can't push SDP/ICE to an arbitrary user outside the
 * call's conversation (and can't spoof a target).
 */
export async function assertBothMembers(conversationId: string, a: string, b: string) {
  const [ma, mb] = await Promise.all([
    isMember(conversationId, a),
    isMember(conversationId, b),
  ]);
  if (!ma) throw new ForbiddenError('You are not a member of this conversation');
  if (!mb) throw new ForbiddenError('Target is not a member of this conversation');
}

/**
 * Get-or-create the user's personal "Saved Messages" chat — a 1-member
 * conversation (only you). Used to bookmark messages, voice notes and files.
 */
export async function getSavedMessages(userId: string) {
  // Exact Saved-Messages identity: a 1-member, non-group conversation that is
  // titled 'Saved Messages' and whose only member is the user. This guarantees
  // we never mistake an ordinary single-person/conversation (or a DM) for the
  // personal bookmarks chat.
  const existing = await prisma.conversation.findFirst({
    where: {
      isGroup: false,
      title: 'Saved Messages',
      members: { every: { userId } },
    },
    include: conversationInclude(userId),
  });
  if (existing) {
    // shapeConversation treats it as a DM with no peer; give it a title + flag.
    const shaped = shapeConversation(existing, userId, existing.members.find((m: { userId: string }) => m.userId === userId)?.lastReadAt ?? null);
    return { ...shaped, isSaved: true, memberCount: 1 };
  }
  const created = await prisma.conversation.create({
    data: {
      isGroup: false,
      title: 'Saved Messages',
      members: { create: { userId } },
    },
    include: conversationInclude(userId),
  });
  return { ...shapeConversation(created, userId, null), isSaved: true, memberCount: 1 };
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
                select: { id: true, username: true, fullName: true, avatarUrl: true, isPhoneVerified: true, isIdVerified: true },
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
        include: { user: { select: { id: true, username: true, fullName: true, avatarUrl: true, isPhoneVerified: true, isIdVerified: true } } },
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
    isSaved: isSavedMessageConversation(conv),
    createdAt: conv.createdAt,
    members: conv.members.map((m) => ({
      userId: m.userId,
      isAdmin: m.isAdmin,
      joinedAt: m.joinedAt,
      lastReadAt: m.lastReadAt,
      online: isOnline(m.userId),
      ...m.user,
      isVerified: !!(m.user.isPhoneVerified && m.user.isIdVerified),
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
      sender: { select: { id: true, username: true, fullName: true, avatarUrl: true, isPhoneVerified: true, isIdVerified: true } },
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
    const buckets: Record<string, { emoji: string; count: number; mine: boolean; reactorIds: string[] }> = {};
    for (const r of m.reactions) {
      const b = buckets[r.emoji] ?? (buckets[r.emoji] = { emoji: r.emoji, count: 0, mine: false, reactorIds: [] });
      b.count++;
      if (r.userId === userId) b.mine = true;
      b.reactorIds.push(r.userId);
    }
    const readers = readTimes.filter((rt) => rt.lastReadAt && rt.lastReadAt >= m.createdAt).map((rt) => rt.userId);
    return { ...m, reactions: Object.values(buckets), readBy: readers.length, readByTotal: readTimes.length, readByUserIds: readers };
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
        sender: { select: { id: true, username: true, fullName: true, avatarUrl: true, isPhoneVerified: true, isIdVerified: true } },
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

/** Ensure a team has exactly one shared group conversation and that its
 *  membership mirrors the roster. Any team member can open it; leavers keep
 *  their message history but new rosters always get added on open. */
export async function ensureTeamConversation(input: { userId: string; agencyId: string }) {
  const membership = await prisma.agencyMember.findUnique({
    where: { agencyId_userId: { agencyId: input.agencyId, userId: input.userId } },
    select: { role: true },
  });
  if (!membership) throw new ForbiddenError('You are not in this team');

  const roster = await prisma.agencyMember.findMany({
    where: { agencyId: input.agencyId },
    select: { role: true, userId: true },
  });

  let conversation = await prisma.conversation.findFirst({
    where: { agencyId: input.agencyId },
  });

  if (!conversation) {
    const agency = await prisma.agency.findUniqueOrThrow({
      where: { id: input.agencyId },
      select: { name: true, ownerId: true },
    });
    conversation = await prisma.conversation.create({
      data: {
        isGroup: true,
        title: `${agency.name} — team chat`,
        createdById: agency.ownerId,
        agencyId: input.agencyId,
        members: {
          createMany: {
            data: roster.map((m) => ({
              userId: m.userId,
              isAdmin: m.role !== 'MEMBER',
            })),
          },
        },
      },
    });
    return { id: conversation.id };
  }

  // Membership sync: add anyone who joined since the last open.
  const present = await prisma.conversationMember.findMany({
    where: { conversationId: conversation.id },
    select: { userId: true },
  });
  const have = new Set(present.map((p) => p.userId));
  const missing = roster.filter((m) => !have.has(m.userId));
  if (missing.length > 0) {
    await prisma.conversationMember.createMany({
      data: missing.map((m) => ({
        conversationId: conversation!.id,
        userId: m.userId,
        isAdmin: m.role !== 'MEMBER',
      })),
    });
  }
  return { id: conversation.id };
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

/** Mute / unmute a conversation for the current user. */
export async function setConversationMuted(conversationId: string, userId: string, muted: boolean) {
  await assertMember(conversationId, userId);
  return prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { isMuted: muted },
    select: { isMuted: true },
  });
}

/** Mark a conversation as unread (resets lastReadAt so unread badge returns). */
export async function markUnread(conversationId: string, userId: string) {
  await assertMember(conversationId, userId);
  return prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: null },
    select: { lastReadAt: true },
  });
}

/** Forward a message from one conversation to another (as the sender's own message). */
export async function forwardMessage(fromId: string, messageId: string, senderId: string, targetId: string) {
  await assertMember(fromId, senderId);
  if (fromId !== targetId) await assertMember(targetId, senderId);
  const source = await prisma.message.findUnique({
    where: { id: messageId },
    select: { conversationId: true, body: true, attachmentUrl: true, attachmentType: true, attachmentMeta: true },
  });
  if (!source || source.conversationId !== fromId) throw new NotFoundError('Message');
  const message = await prisma.$transaction(async (tx) => {
    const m = await tx.message.create({
      data: {
        conversationId: targetId,
        senderId,
        body: source.body,
        attachmentUrl: source.attachmentUrl,
        attachmentType: source.attachmentType,
        // Tag forwarded messages so the UI can show "Forwarded".
        attachmentMeta: { ...(source.attachmentMeta as Record<string, unknown> | undefined), forwarded: true, forwardedFrom: fromId } as never,
      },
      include: { sender: { select: { id: true, username: true, fullName: true, avatarUrl: true } } },
    });
    await tx.conversation.update({ where: { id: targetId }, data: { lastMessageAt: m.createdAt } });
    return m;
  });
  // Notify the target's other members (reuses sendMessage broadcast helper).
  const others = await prisma.conversationMember.findMany({
    where: { conversationId: targetId, userId: { not: senderId } },
    select: { userId: true },
  });
  const previewBody = (message.body ?? '').slice(0, 140) || '📎 Forwarded message';
  const { sendPush } = await import('./push.service.js');
  await Promise.all(
    others.map(async (m) => {
      await notify({
        userId: m.userId,
        type: 'NEW_MESSAGE',
        title: `New message from ${message.sender.fullName}`,
        body: previewBody,
        payload: { conversationId: targetId, messageId: message.id },
      });
      void sendPush(m.userId, { title: message.sender.fullName, body: previewBody, url: `/messages/${targetId}`, tag: `conv-${targetId}` });
    }),
  );
  return message;
}

/** Search text within a conversation. Newest-first, capped. */
export async function searchMessages(conversationId: string, userId: string, query: string) {
  await assertMember(conversationId, userId);
  const q = query.trim();
  if (!q) return { items: [] };
  const items = await prisma.message.findMany({
    where: {
      conversationId,
      deletedAt: null,
      body: { contains: q, mode: 'insensitive' },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true, body: true, senderId: true, attachmentType: true, createdAt: true,
      sender: { select: { id: true, username: true, fullName: true, avatarUrl: true, isPhoneVerified: true, isIdVerified: true } },
    },
  });
  return { items };
}

/** Pin / unpin a message in a conversation. */
export async function setPinned(conversationId: string, messageId: string, userId: string, pinned: boolean) {
  await assertMember(conversationId, userId);
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { conversationId: true },
  });
  if (!message || message.conversationId !== conversationId) throw new NotFoundError('Message');
  return prisma.message.update({
    where: { id: messageId },
    data: { pinnedAt: pinned ? new Date() : null },
    select: { id: true, pinnedAt: true },
  });
}

/** Generate (or return) a join link for a group. Anyone with the link can join. */
export async function getGroupInvite(conversationId: string, userId: string) {
  const conv = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    select: { isGroup: true, title: true, id: true, inviteToken: true },
  });
  if (!conv.isGroup) throw new BadRequestError('Invite links are for groups only');
  await assertMember(conversationId, userId);
  let token = conv.inviteToken;
  if (!token) {
    const { randomBytes } = await import('node:crypto');
    token = randomBytes(9).toString('base64url');
    await prisma.conversation.update({ where: { id: conversationId }, data: { inviteToken: token } });
  }
  return { conversationId, title: conv.title, token };
}

/** Join a group via an invite token. */
export async function joinGroupByInvite(token: string, userId: string, route: 'api' | 'web') {
  await assertPhoneVerified(userId);
  const mapping = await prisma.conversation.findUnique({
    where: { inviteToken: token },
    select: { id: true, title: true },
  });
  if (!mapping) throw new NotFoundError('Invite');
  await prisma.conversationMember.upsert({
    where: { conversationId_userId: { conversationId: mapping.id, userId } },
    create: { conversationId: mapping.id, userId },
    update: {},
  });
  return { conversationId: mapping.id, title: mapping.title, route };
}

// ==========================
// Helpers
// ==========================

const conversationInclude = (_selfId: string) => ({
  members: {
    include: {
      user: {
        select: { id: true, username: true, fullName: true, avatarUrl: true, isPhoneVerified: true, isIdVerified: true },
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
/** A conversation is the user's personal Saved Messages only when it is a
 * 1-member, non-group chat titled 'Saved Messages'. */
function isSavedMessageConversation(conv: {
  isGroup: boolean;
  title: string | null;
  members: unknown[];
}): boolean {
  return !conv.isGroup && conv.title === 'Saved Messages' && conv.members.length === 1;
}

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
    peer: peer ? { ...peer, online: isOnline(peer.id), isVerified: !!(peer.isPhoneVerified && peer.isIdVerified) } : null,
    lastMessage,
    lastMessageAt: conv.lastMessageAt,
    unread,
    updatedAt: conv.updatedAt,
  };
}


// Link previews (OpenGraph unfurl) are implemented in their own module so the
// pure parser can be unit-tested without a DB connection.
export { unfurl } from './link-preview.js';
