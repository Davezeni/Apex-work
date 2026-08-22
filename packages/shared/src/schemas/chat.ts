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
