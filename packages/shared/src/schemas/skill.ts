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
    /^[a-zA-Z0-9][a-zA-Z0-9 \-+&#./]*$/,
    'Use letters, numbers, spaces, and . - + & # / only',
  );

export const createSkillSchema = z.object({
  name: skillNameSchema,
});
export type CreateSkillInput = z.infer<typeof createSkillSchema>;
