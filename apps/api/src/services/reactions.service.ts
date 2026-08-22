/**
 * Message reactions. One row per (message, user, emoji) — deleting a row
 * removes the reaction. Server enforces that the user is a member of the
 * conversation the message belongs to, so people can't react to messages
 * in chats they don't belong to.
 */
import { prisma } from '../lib/prisma.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';
import { REACTION_EMOJIS, type ReactionEmoji } from '@apex-work/shared';
import { assertMember } from './chat.service.js';

export async function toggleReaction(messageId: string, userId: string, emoji: string) {
  if (!(REACTION_EMOJIS as readonly string[]).includes(emoji)) {
    throw new ForbiddenError('Invalid reaction');
  }
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, conversationId: true },
  });
  if (!message) throw new NotFoundError('Message');
  await assertMember(message.conversationId, userId);

  // Unique constraint on (message,user,emoji) lets us "toggle" cheaply.
  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId, emoji: emoji as ReactionEmoji } },
    select: { id: true },
  });
  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
    return { messageId, emoji, added: false, conversationId: message.conversationId };
  }
  await prisma.messageReaction.create({
    data: { messageId, userId, emoji },
  });
  return { messageId, emoji, added: true, conversationId: message.conversationId };
}

export async function listReactionsForMessages(messageIds: string[]) {
  if (messageIds.length === 0) return {} as Record<string, { emoji: string; count: number; mine: boolean }[]>;
  const rows = await prisma.messageReaction.findMany({
    where: { messageId: { in: messageIds } },
    select: { messageId: true, emoji: true, userId: true },
  });
  return rows.reduce<Record<string, { emoji: string; count: number; users: Set<string> }[]>>((acc, r) => {
    const list = acc[r.messageId] ?? (acc[r.messageId] = []);
    const bucket = list.find((b) => b.emoji === r.emoji);
    if (bucket) {
      bucket.count++;
      bucket.users.add(r.userId);
    } else {
      list.push({ emoji: r.emoji, count: 1, users: new Set([r.userId]) });
    }
    return acc;
  }, {});
}
