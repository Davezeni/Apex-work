import { z } from 'zod';

/**
 * Message reactions — a small emoji whitelist keeps the UI simple, the
 * data compact, and stops abuse. Add to the list if you want more.
 */
export const REACTION_EMOJIS = ['❤️', '👍', '👎', '😂', '😮', '🎉', '🔥', '✅'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export const addReactionSchema = z.object({
  emoji: z.enum(REACTION_EMOJIS),
});
export type AddReactionInput = z.infer<typeof addReactionSchema>;
