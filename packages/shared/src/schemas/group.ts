import { z } from 'zod';

/** Create a group chat with 2-50 other members + optional title/avatar. */
export const createGroupSchema = z.object({
  title: z.string().trim().min(2).max(80),
  avatarUrl: z.string().url().max(1000).nullable().optional(),
  memberIds: z.array(z.string().min(1).max(40)).min(1).max(50),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = z.object({
  title: z.string().trim().min(2).max(80).optional(),
  avatarUrl: z.string().url().max(1000).nullable().optional(),
});
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export const addMemberSchema = z.object({
  userId: z.string().min(1).max(40),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;
