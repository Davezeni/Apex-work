import { z } from 'zod';

/**
 * Skill name — trimmed, 2-40 chars, lettersnumbers spaces dashes plus & # + .
 * Deliberately permissive to fit real skill names like 'C++', 'Node.js', 'AI/ML'.
 */
export const skillNameSchema = z
  .string()
  .trim()
  .min(2, 'Skill name must be at least 2 characters')
  .max(40, 'Skill name must be under 40 characters')
  .regex(
    /^[\p{L}\p{N}][\p{L}\p{N} \-+&#./]*$/u,
    'Use letters, numbers, spaces, and . - + & # / only',
  );

export const createSkillSchema = z.object({
  name: skillNameSchema,
});
export type CreateSkillInput = z.infer<typeof createSkillSchema>;

/** Add a skill to the current user's profile, with an optional 1-5 level rating. */
export const addUserSkillSchema = z
  .object({
    skillId: z.string().min(1).max(40).optional(),
    name: skillNameSchema.optional(),
    level: z.number().int().min(1).max(5).default(3),
  })
  .refine((v) => !!v.skillId || !!v.name, {
    message: 'Provide skillId or a skill name to create',
  });
export type AddUserSkillInput = z.infer<typeof addUserSkillSchema>;

export const updateUserSkillSchema = z.object({
  level: z.number().int().min(1).max(5),
});
export type UpdateUserSkillInput = z.infer<typeof updateUserSkillSchema>;
