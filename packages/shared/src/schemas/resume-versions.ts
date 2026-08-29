import { z } from 'zod';
import { resumeContentSchema } from './resume.js';

/** A named, user-owned snapshot such as "Frontend role — September". */
export const resumeVersionCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
});
export type ResumeVersionCreateInput = z.infer<typeof resumeVersionCreateSchema>;

export const resumeVersionIdSchema = z.object({
  id: z.string().trim().min(10).max(80),
});
export type ResumeVersionIdInput = z.infer<typeof resumeVersionIdSchema>;

/** Internal snapshot contract used when restoring a named version. */
export const resumeVersionSnapshotSchema = z.object({
  headline: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  linkedin: z.string().nullable().optional(),
  github: z.string().nullable().optional(),
  targetRole: z.string().nullable().optional(),
  accentColor: z.string().nullable().optional(),
  templateId: z.string().optional(),
  theme: z.string().optional(),
  isPublic: z.boolean().optional(),
  languages: z.array(z.string()).default([]),
  content: resumeContentSchema.default({}),
  experiences: z
    .array(
      z.object({
        company: z.string(),
        role: z.string(),
        location: z.string().nullable().optional(),
        startYear: z.number().int(),
        startMonth: z.number().int(),
        endYear: z.number().int().nullable().optional(),
        endMonth: z.number().int().nullable().optional(),
        description: z.string().nullable().optional(),
        position: z.number().int().default(0),
      }),
    )
    .max(20)
    .default([]),
  education: z
    .array(
      z.object({
        school: z.string(),
        degree: z.string().nullable().optional(),
        fieldOfStudy: z.string().nullable().optional(),
        startYear: z.number().int(),
        endYear: z.number().int().nullable().optional(),
        description: z.string().nullable().optional(),
        position: z.number().int().default(0),
      }),
    )
    .max(20)
    .default([]),
  certifications: z
    .array(
      z.object({
        name: z.string(),
        issuer: z.string(),
        issueYear: z.number().int(),
        issueMonth: z.number().int().nullable().optional(),
        credentialUrl: z.string().nullable().optional(),
        position: z.number().int().default(0),
      }),
    )
    .max(20)
    .default([]),
});
export type ResumeVersionSnapshot = z.output<typeof resumeVersionSnapshotSchema>;
