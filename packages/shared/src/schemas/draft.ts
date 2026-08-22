import { z } from 'zod';

/**
 * Message draft — durable copy of what a user has typed but not yet sent.
 * Same shape as a message body, but only one draft per (user, conversation)
 * is kept (the client upserts on every keystroke while online).
 */
export const upsertDraftSchema = z.object({
  conversationId: z.string().min(1).max(40),
  body: z.string().max(4000).default(''),
  attachmentUrl: z.string().url().max(1000).nullable().optional(),
  attachmentType: z.enum(['image', 'audio', 'video', 'file']).nullable().optional(),
});
export type UpsertDraftInput = z.infer<typeof upsertDraftSchema>;
