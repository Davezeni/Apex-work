import { z } from 'zod';

const currentYear = new Date().getFullYear();

/**
 * Resume / CV — a structured version of a freelancer's professional
 * history. Kept small on purpose: we render it into a beautiful PDF on
 * the client, so all we need is text-safe fields.
 */
export const resumeSchema = z.object({
  headline: z.string().trim().max(120).nullable().optional(),
  summary: z.string().trim().max(2000).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().email().max(200).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  website: z.string().trim().url().max(300).nullable().optional(),
  linkedin: z.string().trim().url().max(300).nullable().optional(),
  github: z.string().trim().url().max(300).nullable().optional(),
  languages: z.array(z.string().trim().max(60)).max(15).default([]),
  theme: z.enum(['classic', 'modern', 'minimal']).default('classic'),
});
export type ResumeInput = z.infer<typeof resumeSchema>;

const monthSchema = z.number().int().min(1).max(12);
const yearSchema = z.number().int().min(1950).max(currentYear + 1);

export const workExperienceSchema = z
  .object({
    company: z.string().trim().min(1).max(120),
    role: z.string().trim().min(1).max(120),
    location: z.string().trim().max(120).nullable().optional(),
    startYear: yearSchema,
    startMonth: monthSchema,
    endYear: yearSchema.nullable().optional(),
    endMonth: monthSchema.nullable().optional(),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.endYear && v.endMonth) {
      const s = v.startYear * 12 + v.startMonth;
      const e = v.endYear * 12 + v.endMonth;
      if (e < s) {
        ctx.addIssue({ code: 'custom', path: ['endYear'], message: 'End must be after start' });
      }
    }
  });
export type WorkExperienceInput = z.infer<typeof workExperienceSchema>;

export const educationSchema = z.object({
  school: z.string().trim().min(1).max(120),
  degree: z.string().trim().max(120).nullable().optional(),
  fieldOfStudy: z.string().trim().max(120).nullable().optional(),
  startYear: yearSchema,
  endYear: yearSchema.nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
});
export type EducationInput = z.infer<typeof educationSchema>;

export const certificationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  issuer: z.string().trim().min(1).max(160),
  issueYear: yearSchema,
  issueMonth: monthSchema.nullable().optional(),
  credentialUrl: z.string().trim().url().max(300).nullable().optional(),
});
export type CertificationInput = z.infer<typeof certificationSchema>;

/** AI resume enhance — freelancer sends raw text; model returns polished bullets. */
export const enhanceResumeSchema = z.object({
  section: z.enum(['summary', 'experience', 'education']),
  text: z.string().trim().min(10).max(4000),
});
export type EnhanceResumeInput = z.infer<typeof enhanceResumeSchema>;
