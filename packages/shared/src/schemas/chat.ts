import { z } from 'zod';

/** Send a message in a conversation. */
export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(4000).optional(),
  attachmentUrl: z.string().url().max(1000).optional(),
  attachmentType: z.enum(['image', 'audio', 'video', 'file']).optional(),
  /** Optional structured metadata: { size, name, duration, transcript, waveform }. */
  attachmentMeta: z.record(z.unknown()).optional(),
  replyToId: z.string().min(1).max(40).optional(),
  /** Client-generated id — used for optimistic UI + offline draft-flush idempotency. */
  clientId: z.string().min(1).max(64).optional(),
}).refine((v) => !!v.body || !!v.attachmentUrl, {
  message: 'Message must have text or an attachment',
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/** Start (or fetch existing) a 1-to-1 conversation with another user. */
export const startConversationSchema = z.object({
  peerUserId: z.string().min(1).max(40),
  /** Optional order/gig context — associates the conversation with an order. */
  orderId: z.string().min(1).max(40).optional(),
});
export type StartConversationInput = z.infer<typeof startConversationSchema>;

export const listMessagesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

/** Create a chat group / room for several members at once. */
export const createChatGroupSchema = z.object({
  title: z.string().trim().min(1, 'Group needs a name').max(80),
  memberIds: z.array(z.string().min(1).max(40)).min(1, 'Add at least one member').max(50),
  avatarUrl: z.string().url().max(1000).optional(),
});
export type CreateChatGroupInput = z.infer<typeof createChatGroupSchema>;

/** Toggle our emoji reaction on a message. */
export const toggleReactionSchema = z.object({
  emoji: z.string().min(1).max(16),
});
export type ToggleReactionInput = z.infer<typeof toggleReactionSchema>;

/** Add / remove group members, or rename a group. */
export const groupMembersSchema = z.object({
  memberIds: z.array(z.string().min(1).max(40)).min(1).max(50),
});
export type GroupMembersInput = z.infer<typeof groupMembersSchema>;

export const updateChatGroupSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  avatarUrl: z.string().url().max(1000).nullable().optional(),
});
export type UpdateChatGroupInput = z.infer<typeof updateChatGroupSchema>;

/** Mark a message deleted (soft) / edited (body replaced). */
export const editMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(4000),
});
export type EditMessageInput = z.infer<typeof editMessageSchema>;

/** Mute / unmute a conversation. */
export const muteConversationSchema = z.object({ muted: z.boolean() });
export type MuteConversationInput = z.infer<typeof muteConversationSchema>;

/** Pin / unpin a message. */
export const pinMessageSchema = z.object({ pinned: z.boolean() });
export type PinMessageInput = z.infer<typeof pinMessageSchema>;

/** Forward a message into another conversation. */
export const forwardMessageSchema = z.object({ targetConversationId: z.string().min(1).max(40) });
export type ForwardMessageInput = z.infer<typeof forwardMessageSchema>;

/** Search messages. */
export const searchMessagesQuerySchema = z.object({ q: z.string().trim().min(1).max(200) });
export type SearchMessagesQuery = z.infer<typeof searchMessagesQuerySchema>;

export const joinGroupSchema = z.object({ token: z.string().trim().min(8).max(64) });
export type JoinGroupInput = z.infer<typeof joinGroupSchema>;
